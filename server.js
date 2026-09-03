const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const convert = require("heic-convert");
const heicConvert =
    require("heic-convert");


require("dotenv").config();

const app = express();


app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

async function converterHeicParaJpg(arquivo) {

    if (!arquivo) {
        return null;
    }

    const tipo =
        String(
            arquivo.mimetype || ""
        ).toLowerCase();

    const nome =
        String(
            arquivo.originalname || ""
        ).toLowerCase();


    const ehHeic =
        tipo === "image/heic" ||
        tipo === "image/heif" ||
        nome.endsWith(".heic") ||
        nome.endsWith(".heif");


    // Se não for HEIC, mantém normal
    if (!ehHeic) {

        return {

            buffer:
                arquivo.buffer,

            mimetype:
                arquivo.mimetype

        };

    }


    // Converte HEIC para JPEG
    const bufferConvertido =
        await convert({

            buffer:
                arquivo.buffer,

            format:
                "JPEG",

            quality:
                0.9

        });


    return {

        buffer:
            Buffer.from(
                bufferConvertido
            ),

        mimetype:
            "image/jpeg"

    };

}

// ==========================================
// UPLOAD DE FOTO EM MEMÓRIA
// ==========================================

const storage =
    multer.memoryStorage();

const upload =
    multer({

        storage,

        limits: {

            fileSize:
                5 * 1024 * 1024

        },

        fileFilter: (
            req,
            file,
            cb
        ) => {

            if (
                file.mimetype.startsWith(
                    "image/"
                )
            ) {

                cb(
                    null,
                    true
                );

            } else {

                cb(
                    new Error(
                        "Apenas imagens são permitidas"
                    )
                );

            }

        }

    });

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error(
        "ERRO: JWT_SECRET não foi encontrada no .env"
    );
}

// ==========================================
// BANCO DE DADOS
// ==========================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    }
});

// ==========================================
// TESTAR CONEXÃO
// ==========================================

pool.connect()
    .then((client) => {

        console.log(
            "Banco PostgreSQL conectado!"
        );

        client.release();

    })
    .catch((erro) => {

        console.error(
            "Erro ao conectar no banco:",
            erro.message
        );

    });

// ==========================================
// CRIAR TABELAS
// ==========================================

async function criarTabelas() {

    try {

        // ----------------------------------
        // USUÁRIOS
        // ----------------------------------

        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios_financeiro (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(150) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                senha TEXT NOT NULL,
                criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);


        // ----------------------------------
        // CLIENTES
        // ----------------------------------

        await pool.query(`
            CREATE TABLE IF NOT EXISTS clientes_financeiro (
                id SERIAL PRIMARY KEY,

                usuario_id INTEGER NOT NULL,

                nome VARCHAR(200) NOT NULL,

                cpf VARCHAR(20) NOT NULL,

                nascimento DATE NOT NULL,

                endereco TEXT NOT NULL,

                valor_devido NUMERIC(12, 2)
                NOT NULL DEFAULT 0,

                criado_em TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (usuario_id)
                REFERENCES usuarios_financeiro(id)
                ON DELETE CASCADE
            )
        `);

       // ==========================================
// FOTO DO DOCUMENTO
// ==========================================

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS documento_foto BYTEA
`);

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS documento_tipo TEXT
`);

// ==========================================
// FOTO DO ROSTO DO CLIENTE
// ==========================================

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS foto_rosto BYTEA
`);

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS foto_rosto_tipo TEXT
`);


        // ----------------------------------
        // REMOVER VENCIMENTO SE EXISTIR
        // ----------------------------------

        await pool.query(`
            ALTER TABLE clientes_financeiro
            DROP COLUMN IF EXISTS vencimento
        `);

        // ----------------------------------
// PAGAMENTO SEMANAL DO CLIENTE
// ----------------------------------

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS valor_semanal
    NUMERIC(12, 2)
`);

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS dia_pagamento
    INTEGER
`);

// ==========================================
// CAMPOS SEPARADOS DO ENDEREÇO
// ==========================================

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS rua TEXT
`);

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS numero TEXT
`);

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS bairro TEXT
`);

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS cidade TEXT
`);

await pool.query(`
    ALTER TABLE clientes_financeiro
    ADD COLUMN IF NOT EXISTS estado TEXT
`);

        // ----------------------------------
        // PAGAMENTOS
        // ----------------------------------

        await pool.query(`
            CREATE TABLE IF NOT EXISTS pagamentos_financeiro (
                id SERIAL PRIMARY KEY,

                cliente_id INTEGER NOT NULL,

                valor NUMERIC(12, 2)
                NOT NULL,

                criado_em TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (cliente_id)
                REFERENCES clientes_financeiro(id)
                ON DELETE CASCADE
            )
        `);

        // ----------------------------------
// COBRANÇAS INDIVIDUAIS
// ----------------------------------

await pool.query(`
    CREATE TABLE IF NOT EXISTS cobrancas_financeiro (

        id SERIAL PRIMARY KEY,

        cliente_id INTEGER NOT NULL,

        usuario_id INTEGER NOT NULL,

        data_cobranca DATE NOT NULL,

        valor_original NUMERIC(12, 2)
        NOT NULL,

        juros_percentual NUMERIC(8, 2)
        DEFAULT 0,

        juros_valor NUMERIC(12, 2)
        DEFAULT 0,

        status VARCHAR(30)
        NOT NULL DEFAULT 'pendente',

        quitado_em TIMESTAMPTZ,

        criado_em TIMESTAMPTZ
        DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (cliente_id)
        REFERENCES clientes_financeiro(id)
        ON DELETE CASCADE,

        FOREIGN KEY (usuario_id)
        REFERENCES usuarios_financeiro(id)
        ON DELETE CASCADE
    )
`);

// ----------------------------------
// PAGAMENTOS DAS COBRANÇAS
// ----------------------------------

await pool.query(`
    CREATE TABLE IF NOT EXISTS
    pagamentos_cobrancas_financeiro (

        id SERIAL PRIMARY KEY,

        cobranca_id INTEGER NOT NULL,

        valor NUMERIC(12, 2)
        NOT NULL,

        criado_em TIMESTAMPTZ
        DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (cobranca_id)
        REFERENCES cobrancas_financeiro(id)
        ON DELETE CASCADE
    )
`);
await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    cobranca_cliente_data_unica

    ON cobrancas_financeiro (
        cliente_id,
        data_cobranca
    )
`);

// ----------------------------------
// PAGAMENTOS DA DÍVIDA TOTAL
// ----------------------------------

await pool.query(`
    CREATE TABLE IF NOT EXISTS
    pagamentos_divida_financeiro (

        id SERIAL PRIMARY KEY,

        cliente_id INTEGER NOT NULL,

        valor NUMERIC(12, 2)
        NOT NULL,

        criado_em TIMESTAMPTZ
        DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (cliente_id)
        REFERENCES clientes_financeiro(id)
        ON DELETE CASCADE
    )
`);

  // ----------------------------------
// SEMANA DE REFERÊNCIA DO PAGAMENTO
// ----------------------------------

await pool.query(`
    ALTER TABLE pagamentos_financeiro
    ADD COLUMN IF NOT EXISTS semana_referencia DATE
`);

// ----------------------------------
// IMPEDIR PAGAMENTO DUPLICADO
// NA MESMA SEMANA
// ----------------------------------

await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    pagamentos_cliente_semana_unico

    ON pagamentos_financeiro (
        cliente_id,
        semana_referencia
    )

    WHERE semana_referencia IS NOT NULL
`);

        console.log(
            "Tabelas prontas!"
        );

    } catch (erro) {

        console.error(
            "Erro ao criar tabelas:",
            erro.message
        );

    }

}

criarTabelas();

// ==========================================
// GERAR COBRANÇAS DO DIA
// ==========================================

async function gerarCobrancasDoDia(
    usuarioId
) {

    const agoraBrasil = new Date(
        new Date().toLocaleString(
            "en-US",
            {
                timeZone:
                    "America/Maceio"
            }
        )
    );


    const ano =
        agoraBrasil.getFullYear();


    const mes =
        String(
            agoraBrasil.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const dia =
        String(
            agoraBrasil.getDate()
        ).padStart(
            2,
            "0"
        );


    const dataHoje =
        `${ano}-${mes}-${dia}`;


    const diaSemana =
        agoraBrasil.getDay();


    // BUSCAR CLIENTES QUE PAGAM HOJE

    const clientes =
        await pool.query(

            `
            SELECT

                id,

                valor_semanal

            FROM clientes_financeiro

            WHERE

                usuario_id = $1

            AND

                dia_pagamento = $2

            `,

            [

                usuarioId,

                diaSemana

            ]

        );


    // CRIAR COBRANÇA PARA CADA CLIENTE

    for (
        const cliente of clientes.rows
    ) {

        await pool.query(

            `
            INSERT INTO
            cobrancas_financeiro (

                cliente_id,

                usuario_id,

                data_cobranca,

                valor_original

            )

            VALUES (

                $1,

                $2,

                $3,

                $4

            )

            ON CONFLICT (

                cliente_id,

                data_cobranca

            )

            DO NOTHING
            `,

            [

                cliente.id,

                usuarioId,

                dataHoje,

                cliente.valor_semanal

            ]

        );

    }


    return dataHoje;

}


// ==========================================
// VERIFICAR TOKEN
// ==========================================

function verificarToken(
    req,
    res,
    next
) {

    const autorizacao =
        req.headers.authorization;


    if (!autorizacao) {

        return res.status(401).json({

            sucesso: false,

            erro:
                "Token não informado"

        });

    }


    const partes =
        autorizacao.split(" ");


    if (
        partes.length !== 2 ||
        partes[0] !== "Bearer"
    ) {

        return res.status(401).json({

            sucesso: false,

            erro:
                "Formato do token inválido"

        });

    }


    const token =
        partes[1];


    try {

        const dados =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.usuario =
            dados;


        next();

    } catch (erro) {

        console.error(
            "Erro ao verificar token:",
            erro.message
        );


        return res.status(401).json({

            sucesso: false,

            erro:
                "Sessão inválida ou expirada"

        });

    }

}


// ==========================================
// CADASTRAR USUÁRIO
// ==========================================

app.post(
    "/usuarios/cadastro",

    async (req, res) => {

        try {

            const {
                nome,
                email,
                senha
            } = req.body;


            if (
                !nome ||
                !email ||
                !senha
            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Preencha todos os campos"

                });

            }


            const senhaCriptografada =
                await bcrypt.hash(
                    senha,
                    10
                );


            const resultado =
                await pool.query(

                    `
                    INSERT INTO usuarios_financeiro (
                        nome,
                        email,
                        senha
                    )

                    VALUES (
                        $1,
                        $2,
                        $3
                    )

                    RETURNING
                        id,
                        nome,
                        email,
                        criado_em
                    `,

                    [
                        nome.trim(),

                        email
                            .trim()
                            .toLowerCase(),

                        senhaCriptografada
                    ]

                );


            res.status(201).json({

                sucesso: true,

                mensagem:
                    "Usuário cadastrado com sucesso!",

                usuario:
                    resultado.rows[0]

            });

        } catch (erro) {

            console.error(
                "Erro cadastro:",
                erro.message
            );


            if (
                erro.code === "23505"
            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Este e-mail já está cadastrado"

                });

            }


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao cadastrar usuário"

            });

        }

    }

);


// ==========================================
// LOGIN
// ==========================================

app.post(
    "/usuarios/login",

    async (req, res) => {

        try {

            const {
                email,
                senha
            } = req.body;


            if (
                !email ||
                !senha
            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "E-mail e senha são obrigatórios"

                });

            }


            const resultado =
                await pool.query(

                    `
                    SELECT *
                    FROM usuarios_financeiro
                    WHERE email = $1
                    `,

                    [
                        email
                            .trim()
                            .toLowerCase()
                    ]

                );


            if (
                resultado.rows.length === 0
            ) {

                return res.status(401).json({

                    sucesso: false,

                    erro:
                        "E-mail ou senha incorretos"

                });

            }


            const usuario =
                resultado.rows[0];


            const senhaCorreta =
                await bcrypt.compare(
                    senha,
                    usuario.senha
                );


            if (!senhaCorreta) {

                return res.status(401).json({

                    sucesso: false,

                    erro:
                        "E-mail ou senha incorretos"

                });

            }


            const token =
                jwt.sign(

                    {

                        id:
                            usuario.id,

                        email:
                            usuario.email

                    },

                    JWT_SECRET,

                    {

                        expiresIn:
                            "7d"

                    }

                );


            res.json({

                sucesso: true,

                mensagem:
                    "Login realizado com sucesso!",

                token,

                usuario: {

                    id:
                        usuario.id,

                    nome:
                        usuario.nome,

                    email:
                        usuario.email

                }

            });

        } catch (erro) {

            console.error(
                "Erro login:",
                erro.message
            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao fazer login"

            });

        }

    }

);


// ==========================================
// UPLOAD DE DOCUMENTOS
// ==========================================

const uploadDocumento = multer({

    storage,

    limits: {

        fileSize:
            10 * 1024 * 1024

    },

    fileFilter: (
        req,
        file,
        cb
    ) => {

        if (
            file.mimetype &&
            file.mimetype.startsWith(
                "image/"
            )
        ) {

            cb(
                null,
                true
            );

        } else {

            cb(
                new Error(
                    "Apenas imagens são permitidas"
                )
            );

        }

    }

});

// ==========================================
// CADASTRAR CLIENTE
// ==========================================

app.post(

    "/clientes",

    verificarToken,

    uploadDocumento.fields([
    {
        name: "documento",
        maxCount: 1
    },
    {
        name: "foto_rosto",
        maxCount: 1
    }
]),

    async (req, res) => {

        try {

            const {

                nome,
                cpf,
                nascimento,

                rua,
                numero,
                bairro,
                cidade,
                estado,

                valor_devido,
                valor_semanal,
                dia_pagamento

            } = req.body;


            // ==================================
            // VALIDAR CAMPOS
            // ==================================

            if (

                !nome ||
                !cpf ||
                !nascimento ||

                !rua ||
                !numero ||
                !bairro ||
                !cidade ||
                !estado ||

                valor_devido === undefined ||
                valor_semanal === undefined ||
                dia_pagamento === undefined

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Preencha todos os campos obrigatórios"

                });

            }


            const valor =
                Number(valor_devido);


            const valorSemanal =
                Number(valor_semanal);


            const diaPagamento =
                Number(dia_pagamento);


            // ==================================
            // VALIDAR VALOR DEVIDO
            // ==================================

            if (

                Number.isNaN(valor) ||
                valor < 0

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Valor devido inválido"

                });

            }


            // ==================================
            // VALIDAR VALOR SEMANAL
            // ==================================

            if (

                Number.isNaN(valorSemanal) ||
                valorSemanal <= 0

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Valor semanal inválido"

                });

            }


            // ==================================
            // VALIDAR DIA DE PAGAMENTO
            // ==================================

            if (

                !Number.isInteger(diaPagamento) ||
                diaPagamento < 0 ||
                diaPagamento > 6

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Dia de pagamento inválido"

                });

            }

// ==================================
// DOCUMENTO
// ==================================

const arquivoDocumento =
    req.files &&
    req.files.documento
        ? req.files.documento[0]
        : null;


const documentoConvertido =
    await converterHeicParaJpg(
        arquivoDocumento
    );


const documentoFoto =
    documentoConvertido
        ? documentoConvertido.buffer
        : null;


const documentoTipo =
    documentoConvertido
        ? documentoConvertido.mimetype
        : null;


// ==================================
// FOTO DO ROSTO
// ==================================

const arquivoFotoRosto =
    req.files &&
    req.files.foto_rosto
        ? req.files.foto_rosto[0]
        : null;


const fotoRostoConvertida =
    await converterHeicParaJpg(
        arquivoFotoRosto
    );


const fotoRosto =
    fotoRostoConvertida
        ? fotoRostoConvertida.buffer
        : null;


const fotoRostoTipo =
    fotoRostoConvertida
        ? fotoRostoConvertida.mimetype
        : null;


            // ==================================
            // ENDEREÇO COMPLETO
            // ==================================

            const enderecoCompleto =
                `${rua.trim()}, ${numero.trim()} - ` +
                `${bairro.trim()}, ${cidade.trim()} - ` +
                `${estado.trim()}`;


            // ==================================
            // CADASTRAR CLIENTE
            // ==================================

            const resultado =
                await pool.query(

                    `
                    INSERT INTO clientes_financeiro (

                        usuario_id,
                        nome,
                        cpf,
                        nascimento,

                        endereco,

                        rua,
                        numero,
                        bairro,
                        cidade,
                        estado,

                        valor_devido,
                        valor_semanal,
                        dia_pagamento,

                        documento_foto,
documento_tipo,

foto_rosto,
foto_rosto_tipo
                    )

                    VALUES (

                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        $13,
                        $14,
                        $15,
                        $16,
                        $17

                    )

                    RETURNING *
                    `,

                    [

                        req.usuario.id,

                        nome.trim(),

                        cpf.trim(),

                        nascimento,

                        enderecoCompleto,

                        rua.trim(),

                        numero.trim(),

                        bairro.trim(),

                        cidade.trim(),

                        estado.trim(),

                        valor,

                        valorSemanal,

                        diaPagamento,

                        documentoFoto,

                        documentoTipo,

                        fotoRosto,

                        fotoRostoTipo

                    ]

                );


            res.status(201).json({

                sucesso: true,

                mensagem:
                    "Cliente cadastrado com sucesso!",

                cliente:
                    resultado.rows[0]

            });


        } catch (erro) {

            console.error(
                "Erro ao cadastrar cliente:",
                erro
            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao cadastrar cliente"

            });

        }

    }

);

// ==========================================
// LISTAR CLIENTES
// ==========================================

app.get(
    "/clientes",

    verificarToken,

    async (req, res) => {

        try {
const resultado =
    await pool.query(

        `
        SELECT

            c.id,

            c.nome,

            c.documento_foto IS NOT NULL
            AS possui_documento,

c.foto_rosto IS NOT NULL
AS possui_foto_rosto,

            c.cpf,

            c.nascimento,

            c.endereco,

            c.rua,

c.numero,

c.bairro,

c.cidade,

            c.valor_devido,

            c.valor_semanal,

            c.dia_pagamento,

            c.criado_em,

            COALESCE(
                SUM(p.valor),
                0
            ) AS total_pago,

            c.valor_devido
            AS saldo_restante

        FROM clientes_financeiro c

        LEFT JOIN pagamentos_financeiro p

        ON
            p.cliente_id = c.id

        WHERE

            c.usuario_id = $1

        GROUP BY

            c.id,

            c.nome,

            c.documento_foto,

            c.documento_tipo,

            c.foto_rosto,

            c.foto_rosto_tipo,

            c.cpf,

            c.nascimento,

            c.endereco,

            c.rua,

c.numero,

c.bairro,

c.cidade,

            c.valor_devido,

            c.valor_semanal,

            c.dia_pagamento,

            c.criado_em

        ORDER BY
            c.id DESC
        `,

        [
            req.usuario.id
        ]

    );


            res.json({

                sucesso: true,

                clientes:
                    resultado.rows

            });

        } catch (erro) {

            console.error(
                "Erro ao listar clientes:",
                erro.message
            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao carregar clientes"

            });

        }

    }

);

// ==========================================
// VER FOTO DO DOCUMENTO
// ==========================================

app.get(

    "/clientes/:id/documento",

    verificarToken,

    async (req, res) => {

        try {

            const clienteId =
                Number(req.params.id);


            const resultado =
                await pool.query(

                    `
                    SELECT

                        documento_foto,
                        documento_tipo

                    FROM clientes_financeiro

                    WHERE id = $1

                    AND usuario_id = $2
                    `,

                    [

                        clienteId,

                        req.usuario.id

                    ]

                );


            if (
                resultado.rows.length === 0
            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            const cliente =
                resultado.rows[0];


            if (
                !cliente.documento_foto
            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Este cliente não possui documento"

                });

            }


            const imagem =
                Buffer.from(
                    cliente.documento_foto
                );


            // NÃO FORÇAR JPEG
            const tipoImagem =
                cliente.documento_tipo ||
                "application/octet-stream";


            console.log(
                "Tipo do documento:",
                tipoImagem
            );


            res.setHeader(
                "Content-Type",
                tipoImagem
            );


            res.setHeader(
                "Content-Length",
                imagem.length
            );


            res.setHeader(
                "Content-Disposition",
                "inline"
            );


            return res.end(
                imagem
            );


        } catch (erro) {

            console.error(
                "Erro ao carregar documento:",
                erro
            );


            return res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao carregar documento"

            });

        }

    }

);

// ==========================================
// VER FOTO DO ROSTO
// ==========================================

app.get(

    "/clientes/:id/foto",

    verificarToken,

    async (req, res) => {

        try {

            const clienteId =
                Number(
                    req.params.id
                );


            const resultado =
                await pool.query(

                    `
                    SELECT

                        foto_rosto,
                        foto_rosto_tipo

                    FROM clientes_financeiro

                    WHERE

                        id = $1

                    AND

                        usuario_id = $2
                    `,

                    [

                        clienteId,

                        req.usuario.id

                    ]

                );


            if (
                resultado.rows.length === 0
            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            const cliente =
                resultado.rows[0];


            if (
                !cliente.foto_rosto
            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Este cliente não possui foto"

                });

            }


            const imagem =
    Buffer.from(
        cliente.foto_rosto
    );

const tipoImagem =
    cliente.foto_rosto_tipo ||
    "application/octet-stream";

console.log(
    "Tipo da foto:",
    tipoImagem
);

res.setHeader(
    "Content-Type",
    tipoImagem
);

res.setHeader(
    "Content-Length",
    imagem.length
);

res.setHeader(
    "Content-Disposition",
    "inline"
);

return res.end(
    imagem
);


        } catch (erro) {

            console.error(
                "Erro ao carregar foto:",
                erro.message
            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao carregar foto"

            });

        }

    }

);

// ==========================================
// REGISTRAR PAGAMENTO SEMANAL
// ==========================================

app.post(
    "/clientes/:id/pagamentos",

    verificarToken,

    async (req, res) => {

        const clienteId =
            Number(
                req.params.id
            );


        if (

            !Number.isInteger(clienteId) ||
            clienteId <= 0

        ) {

            return res.status(400).json({

                sucesso: false,

                erro:
                    "Cliente inválido"

            });

        }


        let client;


        try {

            client =
                await pool.connect();


            await client.query(
                "BEGIN"
            );


            // ==================================
            // BUSCAR CLIENTE
            // ==================================

            const clienteResultado =
                await client.query(

                    `
                    SELECT

                        c.id,

                        c.valor_devido,

                        c.valor_semanal,

                        c.dia_pagamento,


                        COALESCE(
                            SUM(p.valor),
                            0
                        ) AS total_pago


                    FROM clientes_financeiro c


                    LEFT JOIN pagamentos_financeiro p

                    ON
                        p.cliente_id = c.id


                    WHERE

                        c.id = $1

                    AND

                        c.usuario_id = $2


                    GROUP BY

                        c.id,

                        c.valor_devido,

                        c.valor_semanal,

                        c.dia_pagamento
                    `,

                    [

                        clienteId,

                        req.usuario.id

                    ]

                );


            if (

                clienteResultado.rows.length === 0

            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            const cliente =
                clienteResultado.rows[0];


            const valorSemanal =
                Number(
                    cliente.valor_semanal
                );



        

            // CALCULAR VALOR DO PAGAMENTO
// O pagamento semanal NÃO altera a dívida total

const valorPagamento =
    valorSemanal;


            if (

                !valorPagamento ||
                valorPagamento <= 0

            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Valor semanal inválido"

                });

            }


            // ==================================
            // DEFINIR SEMANA DE REFERÊNCIA
            // ==================================

            const hoje =
                new Date();


            const diaDaSemana =
                hoje.getDay();


            const diferenca =
                hoje.getDate() -
                diaDaSemana;


            const domingo =
                new Date(
                    hoje
                );


            domingo.setDate(
                diferenca
            );


            domingo.setHours(
                0,
                0,
                0,
                0
            );


            const ano =
                domingo.getFullYear();


            const mes =
                String(
                    domingo.getMonth() + 1
                ).padStart(
                    2,
                    "0"
                );


            const dia =
                String(
                    domingo.getDate()
                ).padStart(
                    2,
                    "0"
                );


            const semanaReferencia =
                `${ano}-${mes}-${dia}`;

            // ==================================
            // VERIFICAR PAGAMENTO DA SEMANA
            // ==================================

            const pagamentoExistente =
                await client.query(

                    `
                    SELECT id

                    FROM pagamentos_financeiro

                    WHERE

                        cliente_id = $1

                    AND

                        semana_referencia = $2
                    `,

                    [

                        clienteId,

                        semanaReferencia

                    ]

                );


            if (

                pagamentoExistente.rows.length > 0

            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Este cliente já possui um pagamento registrado nesta semana"

                });

            }


            // ==================================
            // REGISTRAR PAGAMENTO
            // ==================================

            const resultado =
                await client.query(

                    `
                    INSERT INTO pagamentos_financeiro (

                        cliente_id,

                        valor,

                        semana_referencia

                    )

                    VALUES (

                        $1,

                        $2,

                        $3

                    )

                    RETURNING *
                    `,

                    [

                        clienteId,

                        valorPagamento,

                        semanaReferencia

                    ]

                );


            await client.query(
                "COMMIT"
            );


            res.status(201).json({

                sucesso: true,

                mensagem:
                    "Pagamento semanal registrado com sucesso!",


                pagamento:
                    resultado.rows[0],


                valor_pago:
                    valorPagamento,


                semana_referencia:
                    semanaReferencia

            });

        } catch (erro) {

            if (client) {

                await client.query(
                    "ROLLBACK"
                ).catch(
                    () => {}
                );

            }


            console.error(
                "Erro pagamento semanal:",
                erro.message
            );


            // ERRO DO ÍNDICE ÚNICO

            if (
                erro.code === "23505"
            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Este cliente já possui pagamento nesta semana"

                });

            }


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao registrar pagamento"

            });

        } finally {

            if (client) {

                client.release();

            }

        }

    }

);

// ==========================================
// HISTÓRICO COMPLETO DE PAGAMENTOS
// SEMANAIS + COBRANÇAS + JUROS
// ==========================================

app.get(
    "/clientes/:id/pagamentos",

    verificarToken,

    async (req, res) => {

        try {

            const clienteId =
                Number(req.params.id);


            // ==================================
            // VERIFICAR SE O CLIENTE PERTENCE
            // AO USUÁRIO LOGADO
            // ==================================

            const clienteResultado =
                await pool.query(

                    `
                    SELECT id

                    FROM clientes_financeiro

                    WHERE
                        id = $1

                    AND
                        usuario_id = $2
                    `,

                    [
                        clienteId,
                        req.usuario.id
                    ]

                );


            if (
                clienteResultado.rows.length === 0
            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            // ==================================
            // BUSCAR TODOS OS PAGAMENTOS
            // ==================================

            const resultado =
                await pool.query(

                    `
                    SELECT

                        pagamento_id AS id,

                        valor,

                        tipo,

                        cobranca_id,

                        data_formatada,

                        criado_em

                    FROM (

                        /* =========================
                           PAGAMENTOS SEMANAIS
                        ========================= */

                        SELECT

                            p.id
                            AS pagamento_id,

                            p.valor,

                            'Pagamento semanal'
                            AS tipo,

                            NULL::INTEGER
                            AS cobranca_id,

                            TO_CHAR(

                                p.criado_em
                                AT TIME ZONE
                                'America/Maceio',

                                'DD/MM/YYYY HH24:MI:SS'

                            )
                            AS data_formatada,

                            p.criado_em

                       FROM pagamentos_financeiro p

WHERE
    p.cliente_id = $1


UNION ALL


/* =========================
   QUITAÇÃO DA DÍVIDA TOTAL
========================= */

SELECT

    pd.id
    AS pagamento_id,

    pd.valor,

    'Quitação da dívida'
    AS tipo,

    NULL::INTEGER
    AS cobranca_id,

    TO_CHAR(

        pd.criado_em
        AT TIME ZONE
        'America/Maceio',

        'DD/MM/YYYY HH24:MI:SS'

    )
    AS data_formatada,

    pd.criado_em

FROM
    pagamentos_divida_financeiro pd

WHERE

    pd.cliente_id = $1


UNION ALL


/* =========================
   PAGAMENTOS DE COBRANÇAS
   INCLUINDO JUROS
========================= */

SELECT

    pc.id
    AS pagamento_id,

    pc.valor,

    CASE

        WHEN
            co.juros_valor > 0

        THEN

            'Pagamento de cobrança com juros'

        ELSE

            'Pagamento de cobrança'

    END
    AS tipo,

    co.id
    AS cobranca_id,

    TO_CHAR(

        pc.criado_em
        AT TIME ZONE
        'America/Maceio',

        'DD/MM/YYYY HH24:MI:SS'

    )
    AS data_formatada,

    pc.criado_em

FROM
    pagamentos_cobrancas_financeiro pc

INNER JOIN
    cobrancas_financeiro co

ON

    co.id =
    pc.cobranca_id

WHERE

    co.cliente_id = $1

AND

    co.usuario_id = $2 



                    ) AS historico


                    ORDER BY

                        criado_em DESC
                    `,

                    [

                        clienteId,

                        req.usuario.id

                    ]

                );


            // ==================================
            // CALCULAR TOTAL
            // ==================================

            const totalPago =
                resultado.rows.reduce(

                    (
                        total,
                        pagamento
                    ) =>

                        total +

                        Number(
                            pagamento.valor
                        ),

                    0

                );


            res.json({

                sucesso: true,

                total_pago:
                    totalPago,

                quantidade:
                    resultado.rows.length,

                pagamentos:
                    resultado.rows

            });

        } catch (erro) {

            console.error(

                "Erro histórico completo:",

                erro.message

            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao carregar histórico"

            });

        }

    }

);

// ==========================================
// EDITAR CLIENTE
// ==========================================

app.put(

    "/clientes/:id",

    verificarToken,

    upload.fields([

        {
            name: "documento",
            maxCount: 1
        },

        {
            name: "foto_rosto",
            maxCount: 1
        }

    ]),

    async (req, res) => {

        try {

            const clienteId =
                Number(req.params.id);


            const {

                nome,
                cpf,
                nascimento,

                rua,
                numero,
                bairro,
                cidade,
                estado,

                valor_devido,
                valor_semanal,
                dia_pagamento

            } = req.body;


            // ==============================
            // VALIDAR ID
            // ==============================

            if (

                !Number.isInteger(clienteId) ||

                clienteId <= 0

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Cliente inválido"

                });

            }


            // ==============================
            // VALIDAR CAMPOS
            // ==============================

            if (

                !nome ||
                !cpf ||
                !nascimento ||

                !rua ||
                !numero ||
                !bairro ||
                !cidade ||
                !estado ||

                valor_devido === undefined ||
                valor_semanal === undefined ||
                dia_pagamento === undefined

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Preencha todos os campos obrigatórios"

                });

            }


            const valor =
                Number(valor_devido);


            const valorSemanal =
                Number(valor_semanal);


            const diaPagamento =
                Number(dia_pagamento);


            // ==============================
            // VALIDAR VALORES
            // ==============================

            if (

                Number.isNaN(valor) ||

                valor < 0

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Valor devido inválido"

                });

            }


            if (

                Number.isNaN(valorSemanal) ||

                valorSemanal <= 0

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Valor semanal inválido"

                });

            }


            if (

                !Number.isInteger(diaPagamento) ||

                diaPagamento < 0 ||

                diaPagamento > 6

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Dia de pagamento inválido"

                });

            }


            // ==============================
            // MONTAR ENDEREÇO
            // ==============================

            const enderecoCompleto =

                `${rua.trim()}, ${numero.trim()} - ` +

                `${bairro.trim()}, ${cidade.trim()} - ` +

                `${estado.trim()}`;


            // ==============================
            // PEGAR ARQUIVOS NOVOS
            // ==============================

            const documento =

                req.files?.documento?.[0] ||

                null;


            const fotoRosto =

                req.files?.foto_rosto?.[0] ||

                null;


            // ==============================
            // CONVERTER HEIC PARA JPEG
            // ==============================

            let documentoBuffer = null;
            let documentoTipo = null;


            if (documento) {

                const tipoDocumento =

                    documento.mimetype.toLowerCase();


                if (

                    tipoDocumento === "image/heic" ||

                    tipoDocumento === "image/heif"

                ) {

                    console.log(
                        "Convertendo documento HEIC para JPEG..."
                    );


                    documentoBuffer =

                        await heicConvert({

                            buffer:
                                documento.buffer,

                            format:
                                "JPEG",

                            quality:
                                0.9

                        });


                    documentoTipo =
                        "image/jpeg";

                } else {

                    documentoBuffer =
                        documento.buffer;


                    documentoTipo =
                        documento.mimetype;

                }

            }


            // ==============================
            // CONVERTER FOTO ROSTO HEIC
            // ==============================

            let fotoRostoBuffer = null;
            let fotoRostoTipo = null;


            if (fotoRosto) {

                const tipoFoto =

                    fotoRosto.mimetype.toLowerCase();


                if (

                    tipoFoto === "image/heic" ||

                    tipoFoto === "image/heif"

                ) {

                    console.log(
                        "Convertendo foto do rosto HEIC para JPEG..."
                    );


                    fotoRostoBuffer =

                        await heicConvert({

                            buffer:
                                fotoRosto.buffer,

                            format:
                                "JPEG",

                            quality:
                                0.9

                        });


                    fotoRostoTipo =
                        "image/jpeg";

                } else {

                    fotoRostoBuffer =
                        fotoRosto.buffer;


                    fotoRostoTipo =
                        fotoRosto.mimetype;

                }

            }


            // ==============================
            // ATUALIZAR DADOS BÁSICOS
            // ==============================

            let query = `

                UPDATE clientes_financeiro

                SET

                    nome = $1,

                    cpf = $2,

                    nascimento = $3,

                    endereco = $4,

                    rua = $5,

                    numero = $6,

                    bairro = $7,

                    cidade = $8,

                    estado = $9,

                    valor_devido = $10,

                    valor_semanal = $11,

                    dia_pagamento = $12

            `;


            const valores = [

                nome.trim(),

                cpf.trim(),

                nascimento,

                enderecoCompleto,

                rua.trim(),

                numero.trim(),

                bairro.trim(),

                cidade.trim(),

                estado.trim(),

                valor,

                valorSemanal,

                diaPagamento

            ];


            let contador =
                13;


            // ==============================
            // ATUALIZAR DOCUMENTO
            // ==============================

            if (documento) {

                query += `

                    , documento_foto = $${contador}

                    , documento_tipo = $${contador + 1}

                `;


                valores.push(

                    documentoBuffer,

                    documentoTipo

                );


                contador += 2;

            }


            // ==============================
            // ATUALIZAR FOTO DO ROSTO
            // ==============================

            if (fotoRosto) {

                query += `

                    , foto_rosto = $${contador}

                    , foto_rosto_tipo = $${contador + 1}

                `;


                valores.push(

                    fotoRostoBuffer,

                    fotoRostoTipo

                );


                contador += 2;

            }


            // ==============================
            // WHERE
            // ==============================

            query += `

                WHERE

                    id = $${contador}

                AND

                    usuario_id = $${contador + 1}

                RETURNING *

            `;


            valores.push(

                clienteId,

                req.usuario.id

            );


            // ==============================
            // EXECUTAR UPDATE
            // ==============================

            const resultado =

                await pool.query(

                    query,

                    valores

                );


            if (

                resultado.rows.length === 0

            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            res.json({

                sucesso: true,

                mensagem:
                    "Cliente atualizado com sucesso!",

                cliente:
                    resultado.rows[0]

            });


        } catch (erro) {

            console.error(

                "Erro ao editar cliente:",

                erro

            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao editar cliente"

            });

        }

    }

);

// ==========================================
// EXCLUIR CLIENTE
// ==========================================

app.delete(
    "/clientes/:id",

    verificarToken,

    async (req, res) => {

        try {

            const clienteId =
                Number(
                    req.params.id
                );


            if (

                !Number.isInteger(clienteId) ||
                clienteId <= 0

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Cliente inválido"

                });

            }


            const resultado =
                await pool.query(

                    `
                    DELETE FROM clientes_financeiro

                    WHERE

                        id = $1

                    AND

                        usuario_id = $2


                    RETURNING id
                    `,

                    [

                        clienteId,

                        req.usuario.id

                    ]

                );


            if (

                resultado.rows.length === 0

            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            res.json({

                sucesso: true,

                mensagem:
                    "Cliente excluído com sucesso!"

            });

        } catch (erro) {

            console.error(
                "Erro ao excluir cliente:",
                erro.message
            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao excluir cliente"

            });

        }

    }

);


// ==========================================
// RELATÓRIO FINANCEIRO
// ==========================================

app.get(
    "/relatorios/pagamentos",

    verificarToken,

    async (req, res) => {

        try {

            const {

                inicio,
                fim

            } = req.query;


            if (

                !inicio ||
                !fim

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Informe a data inicial e final"

                });

            }


            const pagamentosResultado =
                await pool.query(

                    `
                    SELECT

                        p.id,

                        p.valor,


                        TO_CHAR(

                            p.criado_em
                            AT TIME ZONE
                            'America/Maceio',

                            'DD/MM/YYYY HH24:MI:SS'

                        )
                        AS data_formatada,


                        c.id
                        AS cliente_id,


                        c.nome
                        AS cliente_nome,


                        c.cpf
                        AS cliente_cpf


                    FROM pagamentos_financeiro p


                    INNER JOIN clientes_financeiro c

                    ON
                        c.id = p.cliente_id


                    WHERE

                        c.usuario_id = $1


                    AND

                        p.criado_em >= $2::date


                    AND

                        p.criado_em < (
                            $3::date +
                            INTERVAL '1 day'
                        )


                    ORDER BY
                        p.criado_em DESC
                    `,

                    [

                        req.usuario.id,

                        inicio,

                        fim

                    ]

                );


            const resumoResultado =
                await pool.query(

                    `
                    SELECT

                        COUNT(*)
                        AS quantidade_pagamentos,


                        COALESCE(
                            SUM(p.valor),
                            0
                        )
                        AS total_recebido


                    FROM pagamentos_financeiro p


                    INNER JOIN clientes_financeiro c

                    ON
                        c.id = p.cliente_id


                    WHERE

                        c.usuario_id = $1


                    AND

                        p.criado_em >= $2::date


                    AND

                        p.criado_em < (

                            $3::date +

                            INTERVAL '1 day'

                        )
                    `,

                    [

                        req.usuario.id,

                        inicio,

                        fim

                    ]

                );


            res.json({

                sucesso: true,


                periodo: {

                    inicio,

                    fim

                },


                resumo: {

                    quantidade_pagamentos:

                        Number(

                            resumoResultado
                                .rows[0]
                                .quantidade_pagamentos

                        ),


                    total_recebido:

                        Number(

                            resumoResultado
                                .rows[0]
                                .total_recebido

                        )

                },


                pagamentos:

                    pagamentosResultado.rows

            });

        } catch (erro) {

            console.error(
                "Erro ao gerar relatório:",
                erro.message
            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao gerar relatório"

            });

        }

    }

);

// ==========================================
// FOLHA DE PAGAMENTOS
// COBRANÇAS DO DIA + ATRASADAS
// ==========================================

app.get(
    "/pagamentos-semanais",

    verificarToken,

    async (req, res) => {

        try {

            // ==============================
            // GERAR COBRANÇAS DE HOJE
            // ==============================

            const dataHoje =
                await gerarCobrancasDoDia(
                    req.usuario.id
                );


            // ==============================
            // BUSCAR TODAS AS COBRANÇAS
            // PENDENTES E AS DO DIA
            // ==============================

            const resultado =
                await pool.query(

                    `
                    SELECT

                        co.id
                        AS cobranca_id,

                        co.data_cobranca,

                        co.valor_original,

                        co.juros_percentual,

                        co.juros_valor,

                        co.status,

                        co.quitado_em,


                        c.id
                        AS cliente_id,

                        c.nome,

                        c.cpf,

                        c.valor_devido,

                        c.valor_semanal,

                        c.dia_pagamento,


                        COALESCE(

                            SUM(pc.valor),

                            0

                        )
                        AS total_pago


                    FROM cobrancas_financeiro co


                    INNER JOIN
                    clientes_financeiro c

                    ON

                        c.id =
                        co.cliente_id


                    LEFT JOIN
                    pagamentos_cobrancas_financeiro pc

                    ON

                        pc.cobranca_id =
                        co.id


                    WHERE

                        co.usuario_id = $1


                    AND (

                        co.status != 'quitado'

                        OR

                        co.data_cobranca = $2

                    )


                    GROUP BY

                        co.id,

                        co.data_cobranca,

                        co.valor_original,

                        co.juros_percentual,

                        co.juros_valor,

                        co.status,

                        co.quitado_em,


                        c.id,

                        c.nome,

                        c.cpf,

                        c.valor_devido,

                        c.valor_semanal,

                        c.dia_pagamento


                    ORDER BY

                        CASE

                            WHEN
                            co.data_cobranca < $2
                            THEN 0

                            ELSE 1

                        END,


                        co.data_cobranca ASC,


                        c.nome ASC
                    `,

                    [

                        req.usuario.id,

                        dataHoje

                    ]

                );


            const cobrancas =
                resultado.rows.map(
                    (item) => {

                        const valorOriginal =
                            Number(
                                item.valor_original
                            ) || 0;


                        const juros =
                            Number(
                                item.juros_valor
                            ) || 0;


                        const totalPago =
                            Number(
                                item.total_pago
                            ) || 0;


                        const valorTotal =
                            valorOriginal +
                            juros;


                        const saldoRestante =
                            Math.max(

                                valorTotal -
                                totalPago,

                                0

                            );


                        let status =
                            item.status;


                        if (
                            saldoRestante <= 0
                        ) {

                            status =
                                "quitado";

                        } else if (
                            totalPago > 0
                        ) {

                            status =
                                "parcial";

                        } else if (
                            item.data_cobranca <
                            dataHoje
                        ) {

                            status =
                                "atrasado";

                        } else {

                            status =
                                "pendente";

                        }


                        return {

                            ...item,

                            valor_original:
                                valorOriginal,

                            total_pago:
                                totalPago,

                            juros:
                                juros,

                            valor_total:
                                valorTotal,

                            saldo_restante:
                                saldoRestante,

                            status,

                            atrasada:

                                item.data_cobranca <
                                dataHoje

                        };

                    }
                );


            // ==============================
            // RESUMO
            // ==============================

            const pendentes =
                cobrancas.filter(

                    (cobranca) =>

                        cobranca.status ===
                        "pendente"

                );


            const atrasados =
                cobrancas.filter(

                    (cobranca) =>

                        cobranca.status ===
                        "atrasado" ||

                        cobranca.status ===
                        "parcial"

                );


            const quitados =
                cobrancas.filter(

                    (cobranca) =>

                        cobranca.status ===
                        "quitado"

                );


            res.json({

                sucesso: true,

                data_hoje:
                    dataHoje,

                total:
                    cobrancas.length,

                pendentes:
                    pendentes.length,

                atrasados:
                    atrasados.length,

                quitados:
                    quitados.length,

                pagamentos:
                    cobrancas

            });

        } catch (erro) {

            console.error(

                "Erro ao carregar folha:",

                erro.message

            );


            res.status(500).json({

                sucesso: false,

                erro:

                    "Erro ao carregar folha de pagamentos"

            });

        }

    }

);

// ==========================================
// REGISTRAR PAGAMENTO DE UMA COBRANÇA
// ==========================================

app.post(
    "/cobrancas/:id/pagamentos",

    verificarToken,

    async (req, res) => {

        const cobrancaId =
            Number(req.params.id);


        const valor =
            Number(req.body.valor);


        if (
            !Number.isInteger(cobrancaId) ||
            cobrancaId <= 0
        ) {

            return res.status(400).json({

                sucesso: false,

                erro:
                    "Cobrança inválida"

            });

        }


        if (
            Number.isNaN(valor) ||
            valor <= 0
        ) {

            return res.status(400).json({

                sucesso: false,

                erro:
                    "Informe um valor válido"

            });

        }


        let client;


        try {

            client =
                await pool.connect();


            await client.query(
                "BEGIN"
            );


            // ==============================
            // BUSCAR COBRANÇA
            // ==============================

            const cobrancaResultado =
                await client.query(

                    `
                    SELECT

                        co.id,

                        co.valor_original,

                        co.juros_valor,

                        co.status,


                        COALESCE(
                            SUM(pc.valor),
                            0
                        ) AS total_pago


                    FROM cobrancas_financeiro co


                    LEFT JOIN
                    pagamentos_cobrancas_financeiro pc

                    ON
                        pc.cobranca_id = co.id


                    WHERE

                        co.id = $1

                    AND

                        co.usuario_id = $2


                    GROUP BY

                        co.id,

                        co.valor_original,

                        co.juros_valor,

                        co.status
                    `,

                    [

                        cobrancaId,

                        req.usuario.id

                    ]

                );


            if (
                cobrancaResultado.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cobrança não encontrada"

                });

            }


            const cobranca =
                cobrancaResultado.rows[0];


            if (
                cobranca.status === "quitado"
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Esta cobrança já foi quitada"

                });

            }


            const valorOriginal =
                Number(
                    cobranca.valor_original
                );


            const juros =
                Number(
                    cobranca.juros_valor
                ) || 0;


            const totalPago =
                Number(
                    cobranca.total_pago
                ) || 0;


            const valorTotal =
                valorOriginal +
                juros;


            const saldoRestante =
                Math.max(

                    valorTotal -
                    totalPago,

                    0

                );


            // ==============================
            // NÃO DEIXAR PAGAR MAIS
            // QUE O RESTANTE
            // ==============================

            if (
                valor > saldoRestante
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        `O valor é maior que o saldo restante de R$ ${saldoRestante.toFixed(2)}`

                });

            }


            // ==============================
            // REGISTRAR PAGAMENTO
            // ==============================

            const pagamentoResultado =
                await client.query(

                    `
                    INSERT INTO
                    pagamentos_cobrancas_financeiro (

                        cobranca_id,

                        valor

                    )

                    VALUES (

                        $1,

                        $2

                    )

                    RETURNING *
                    `,

                    [

                        cobrancaId,

                        valor

                    ]

                );


            const novoTotalPago =
                totalPago +
                valor;


            const novoSaldo =
                Math.max(

                    valorTotal -
                    novoTotalPago,

                    0

                );


            let novoStatus =
                "parcial";


            if (
                novoSaldo <= 0
            ) {

                novoStatus =
                    "quitado";

            }


            // ==============================
            // ATUALIZAR STATUS
            // ==============================

            await client.query(

                `
                UPDATE cobrancas_financeiro

                SET

                    status = $1,

                    quitado_em =

                        CASE

                            WHEN $1 = 'quitado'

                            THEN CURRENT_TIMESTAMP

                            ELSE NULL

                        END

                WHERE
                    id = $2
                `,

                [

                    novoStatus,

                    cobrancaId

                ]

            );


            await client.query(
                "COMMIT"
            );


            res.status(201).json({

                sucesso: true,

                mensagem:

                    novoStatus === "quitado"

                        ? "Cobrança quitada com sucesso!"

                        : "Pagamento registrado com sucesso!",


                pagamento:

                    pagamentoResultado.rows[0],


                valor_original:

                    valorOriginal,


                valor_pago_agora:

                    valor,


                total_pago:

                    novoTotalPago,


                saldo_restante:

                    novoSaldo,


                status:

                    novoStatus

            });

        } catch (erro) {

            if (client) {

                await client.query(
                    "ROLLBACK"
                ).catch(
                    () => {}
                );

            }


            console.error(

                "Erro ao registrar pagamento:",

                erro.message

            );


            res.status(500).json({

                sucesso: false,

                erro:

                    "Erro ao registrar pagamento"

            });

        } finally {

            if (client) {

                client.release();

            }

        }

    }

);

// ==========================================
// QUITAR COBRANÇA COMPLETAMENTE
// ==========================================

app.post(
    "/cobrancas/:id/quitar",

    verificarToken,

    async (req, res) => {

        const cobrancaId =
            Number(req.params.id);


        if (
            !Number.isInteger(cobrancaId) ||
            cobrancaId <= 0
        ) {

            return res.status(400).json({

                sucesso: false,

                erro:
                    "Cobrança inválida"

            });

        }


        let client;


        try {

            client =
                await pool.connect();


            await client.query(
                "BEGIN"
            );


            // ==============================
            // BUSCAR COBRANÇA
            // ==============================

            const resultado =
                await client.query(

                    `
                    SELECT

                        co.id,

                        co.valor_original,

                        co.juros_valor,

                        co.status,


                        COALESCE(
                            SUM(pc.valor),
                            0
                        ) AS total_pago


                    FROM cobrancas_financeiro co


                    LEFT JOIN
                    pagamentos_cobrancas_financeiro pc

                    ON
                        pc.cobranca_id = co.id


                    WHERE

                        co.id = $1

                    AND

                        co.usuario_id = $2


                    GROUP BY

                        co.id,

                        co.valor_original,

                        co.juros_valor,

                        co.status
                    `,

                    [

                        cobrancaId,

                        req.usuario.id

                    ]

                );


            if (
                resultado.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cobrança não encontrada"

                });

            }


            const cobranca =
                resultado.rows[0];


            if (
                cobranca.status === "quitado"
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Esta cobrança já está quitada"

                });

            }


            const valorOriginal =
                Number(
                    cobranca.valor_original
                );


            const juros =
                Number(
                    cobranca.juros_valor
                ) || 0;


            const totalPago =
                Number(
                    cobranca.total_pago
                ) || 0;


            const valorTotal =
                valorOriginal +
                juros;


            const saldoRestante =
                Math.max(

                    valorTotal -
                    totalPago,

                    0

                );


            // ==============================
            // REGISTRAR O VALOR RESTANTE
            // ==============================

            if (
                saldoRestante > 0
            ) {

                await client.query(

                    `
                    INSERT INTO
                    pagamentos_cobrancas_financeiro (

                        cobranca_id,

                        valor

                    )

                    VALUES (

                        $1,

                        $2

                    )
                    `,

                    [

                        cobrancaId,

                        saldoRestante

                    ]

                );

            }


            // ==============================
            // MARCAR COMO QUITADA
            // ==============================

            await client.query(

                `
                UPDATE cobrancas_financeiro

                SET

                    status = 'quitado',

                    quitado_em =
                        CURRENT_TIMESTAMP

                WHERE
                    id = $1
                `,

                [

                    cobrancaId

                ]

            );


            await client.query(
                "COMMIT"
            );


            res.json({

                sucesso: true,

                mensagem:

                    "Cobrança quitada com sucesso!",


                valor_quitado:

                    saldoRestante,


                valor_total:

                    valorTotal

            });

        } catch (erro) {

            if (client) {

                await client.query(
                    "ROLLBACK"
                ).catch(
                    () => {}
                );

            }


            console.error(

                "Erro ao quitar cobrança:",

                erro.message

            );


            res.status(500).json({

                sucesso: false,

                erro:

                    "Erro ao quitar cobrança"

            });

        } finally {

            if (client) {

                client.release();

            }

        }

    }

);

// ==========================================
// HISTÓRICO DE UMA COBRANÇA
// ==========================================

app.get(
    "/cobrancas/:id/pagamentos",

    verificarToken,

    async (req, res) => {

        const cobrancaId =
            Number(req.params.id);


        try {

            // ==============================
            // VERIFICAR COBRANÇA
            // ==============================

            const cobranca =
                await pool.query(

                    `
                    SELECT id

                    FROM cobrancas_financeiro

                    WHERE

                        id = $1

                    AND

                        usuario_id = $2
                    `,

                    [

                        cobrancaId,

                        req.usuario.id

                    ]

                );


            if (
                cobranca.rows.length === 0
            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cobrança não encontrada"

                });

            }


            // ==============================
            // BUSCAR PAGAMENTOS
            // ==============================

            const resultado =
                await pool.query(

                    `
                    SELECT

                        id,

                        cobranca_id,

                        valor,


                        TO_CHAR(

                            criado_em
                            AT TIME ZONE
                            'America/Maceio',

                            'DD/MM/YYYY HH24:MI:SS'

                        )
                        AS data_formatada


                    FROM
                    pagamentos_cobrancas_financeiro


                    WHERE

                        cobranca_id = $1


                    ORDER BY

                        criado_em DESC
                    `,

                    [

                        cobrancaId

                    ]

                );


            res.json({

                sucesso: true,

                pagamentos:

                    resultado.rows

            });

        } catch (erro) {

            console.error(

                "Erro ao carregar histórico:",

                erro.message

            );


            res.status(500).json({

                sucesso: false,

                erro:

                    "Erro ao carregar histórico"

            });

        }

    }

);

// ==========================================
// APLICAR JUROS NA COBRANÇA
// ==========================================

app.put(
    "/cobrancas/:id/juros",

    verificarToken,

    async (req, res) => {

        const cobrancaId =
            Number(req.params.id);


        const jurosValor =
    Number(req.body.juros_valor);

        if (
            !Number.isInteger(cobrancaId) ||
            cobrancaId <= 0
        ) {

            return res.status(400).json({

                sucesso: false,

                erro:
                    "Cobrança inválida"

            });

        }


        if (
    Number.isNaN(jurosValor) ||
    jurosValor < 0
) {

    return res.status(400).json({

        sucesso: false,

        erro:
            "Valor do juros inválido"

    });

}

        try {

            // ==============================
            // BUSCAR COBRANÇA
            // ==============================

            const resultado =
                await pool.query(

                    `
                    SELECT

                        id,

                        valor_original,

                        status

                    FROM
                    cobrancas_financeiro

                    WHERE

                        id = $1

                    AND

                        usuario_id = $2
                    `,

                    [

                        cobrancaId,

                        req.usuario.id

                    ]

                );


            if (
                resultado.rows.length === 0
            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cobrança não encontrada"

                });

            }


            const cobranca =
                resultado.rows[0];


            if (
                cobranca.status === "quitado"
            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Não é possível aplicar juros em uma cobrança quitada"

                });

            }




            // ==============================
            // ATUALIZAR COBRANÇA
            // ==============================

            const atualizado =
                await pool.query(

                    `
                    UPDATE
cobrancas_financeiro

SET

    juros_percentual = 0,

    juros_valor = $1

WHERE

    id = $2

RETURNING *
                    `,

                    [
    jurosValor,
    cobrancaId
]

                );


            res.json({

                sucesso: true,

                mensagem:

                    "Juros aplicado com sucesso!",


                cobranca:

                    atualizado.rows[0]

            });

        } catch (erro) {

            console.error(

                "Erro ao aplicar juros:",

                erro.message

            );


            res.status(500).json({

                sucesso: false,

                erro:

                    "Erro ao aplicar juros"

            });

        }

    }

);

// ==========================================
// QUITAR DÍVIDA TOTAL DO CLIENTE
// ==========================================

app.post(
    "/clientes/:id/quitar-divida",

    verificarToken,

    async (req, res) => {

        const clienteId =
            Number(req.params.id);


        if (

            !Number.isInteger(clienteId) ||
            clienteId <= 0

        ) {

            return res.status(400).json({

                sucesso: false,

                erro:
                    "Cliente inválido"

            });

        }


        let client;


        try {

            client =
                await pool.connect();


            await client.query(
                "BEGIN"
            );


            // ==============================
            // BUSCAR CLIENTE
            // ==============================

            const resultadoCliente =
                await client.query(

                    `
                    SELECT

                        id,

                        valor_devido

                    FROM clientes_financeiro

                    WHERE

                        id = $1

                    AND

                        usuario_id = $2

                    FOR UPDATE
                    `,

                    [

                        clienteId,

                        req.usuario.id

                    ]

                );


            if (

                resultadoCliente.rows.length === 0

            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            const cliente =
                resultadoCliente.rows[0];


            const valorDevido =
                Number(
                    cliente.valor_devido
                ) || 0;


            // ==============================
            // VERIFICAR SE EXISTE DÍVIDA
            // ==============================

            if (

                valorDevido <= 0

            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Este cliente não possui dívida pendente"

                });

            }


            // ==============================
            // REGISTRAR PAGAMENTO
            // ==============================

            const pagamento =
                await client.query(

                    `
                    INSERT INTO
                    pagamentos_divida_financeiro (

                        cliente_id,

                        valor

                    )

                    VALUES (

                        $1,

                        $2

                    )

                    RETURNING *
                    `,

                    [

                        clienteId,

                        valorDevido

                    ]

                );


            // ==============================
            // ZERAR A DÍVIDA
            // ==============================

            await client.query(

                `
                UPDATE clientes_financeiro

                SET

                    valor_devido = 0

                WHERE

                    id = $1
                `,

                [

                    clienteId

                ]

            );


            await client.query(
                "COMMIT"
            );


            res.json({

                sucesso: true,

                mensagem:
                    "Dívida quitada com sucesso!",

                valor_quitado:
                    valorDevido,

                saldo_restante:
                    0,

                pagamento:
                    pagamento.rows[0]

            });

        } catch (erro) {

            if (client) {

                await client.query(
                    "ROLLBACK"
                ).catch(
                    () => {}
                );

            }


            console.error(

                "Erro ao quitar dívida:",

                erro.message

            );


            res.status(500).json({

                sucesso: false,

                erro:
                    "Erro ao quitar dívida"

            });

        } finally {

            if (client) {

                client.release();

            }

        }

    }

);

// ==========================================
// STATUS
// ==========================================

app.get(
    "/api/status",

    (req, res) => {

        res.json({

            sucesso: true,

            mensagem:
                "API funcionando!"

        });

    }

);


// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(
    PORT,
    "0.0.0.0",

    () => {

        console.log(
            "===================================="
        );

        console.log(
            "SERVIDOR RODANDO!"
        );

        console.log(
            `Porta: ${PORT}`
        );

        console.log(
            "===================================="
        );

    }

);
