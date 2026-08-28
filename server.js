const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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


        // ----------------------------------
        // REMOVER VENCIMENTO SE EXISTIR
        // ----------------------------------

        await pool.query(`
            ALTER TABLE clientes_financeiro
            DROP COLUMN IF EXISTS vencimento
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
// CADASTRAR CLIENTE
// ==========================================

app.post(
    "/clientes",

    verificarToken,

    async (req, res) => {

        try {

            const {

                nome,
                cpf,
                nascimento,
                endereco,
                valor_devido

            } = req.body;


            if (

                !nome ||
                !cpf ||
                !nascimento ||
                !endereco ||
                valor_devido === undefined

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Preencha todos os campos obrigatórios"

                });

            }


            const valor =
                Number(
                    valor_devido
                );


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


            const resultado =
                await pool.query(

                    `
                    INSERT INTO clientes_financeiro (

                        usuario_id,
                        nome,
                        cpf,
                        nascimento,
                        endereco,
                        valor_devido

                    )

                    VALUES (

                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6

                    )

                    RETURNING *
                    `,

                    [

                        req.usuario.id,

                        nome.trim(),

                        cpf.trim(),

                        nascimento,

                        endereco.trim(),

                        valor

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
                erro.message
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

                        c.cpf,

                        c.nascimento,

                        c.endereco,

                        c.valor_devido,

                        c.criado_em,


                        COALESCE(
                            SUM(p.valor),
                            0
                        ) AS total_pago,


                        (
                            c.valor_devido -

                            COALESCE(
                                SUM(p.valor),
                                0
                            )

                        ) AS saldo_restante


                    FROM clientes_financeiro c


                    LEFT JOIN pagamentos_financeiro p

                    ON
                        p.cliente_id = c.id


                    WHERE

                        c.usuario_id = $1


                    GROUP BY

                        c.id,

                        c.nome,

                        c.cpf,

                        c.nascimento,

                        c.endereco,

                        c.valor_devido,

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
// REGISTRAR PAGAMENTO
// ==========================================

app.post(
    "/clientes/:id/pagamentos",

    verificarToken,

    async (req, res) => {

        const clienteId =
            Number(
                req.params.id
            );


        const valor =
            Number(
                req.body.valor
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


        if (

            Number.isNaN(valor) ||
            valor <= 0

        ) {

            return res.status(400).json({

                sucesso: false,

                erro:
                    "Digite um valor válido"

            });

        }


        let client;


        try {

            client =
                await pool.connect();


            await client.query(
                "BEGIN"
            );


            const clienteResultado =
                await client.query(

                    `
                    SELECT

                        c.id,

                        c.valor_devido,


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

                        c.valor_devido
                    `,

                    [

                        clienteId,

                        req.usuario.id

                    ]

                );


            if (

                clienteResultado
                    .rows.length === 0

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


            const saldoRestante =

                Number(
                    cliente.valor_devido
                )

                -

                Number(
                    cliente.total_pago
                );


            if (
                saldoRestante <= 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Este cliente não possui saldo pendente"

                });

            }


            if (
                valor > saldoRestante
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "O valor é maior que o saldo restante"

                });

            }


            const resultado =
                await client.query(

                    `
                    INSERT INTO pagamentos_financeiro (
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
                        valor
                    ]

                );


            await client.query(
                "COMMIT"
            );


            res.status(201).json({

                sucesso: true,

                mensagem:
                    "Pagamento registrado com sucesso!",

                pagamento:
                    resultado.rows[0]

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
                "Erro pagamento:",
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
// HISTÓRICO DE PAGAMENTOS
// ==========================================

app.get(
    "/clientes/:id/pagamentos",

    verificarToken,

    async (req, res) => {

        try {

            const clienteId =
                Number(
                    req.params.id
                );


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

                clienteResultado
                    .rows.length === 0

            ) {

                return res.status(404).json({

                    sucesso: false,

                    erro:
                        "Cliente não encontrado"

                });

            }


            const resultado =
                await pool.query(

                    `
                    SELECT

                        id,

                        cliente_id,

                        valor,


                        TO_CHAR(

                            criado_em
                            AT TIME ZONE
                            'America/Maceio',

                            'DD/MM/YYYY HH24:MI:SS'

                        )
                        AS data_formatada


                    FROM pagamentos_financeiro


                    WHERE
                        cliente_id = $1


                    ORDER BY
                        criado_em DESC
                    `,

                    [
                        clienteId
                    ]

                );


            res.json({

                sucesso: true,

                pagamentos:
                    resultado.rows

            });

        } catch (erro) {

            console.error(
                "Erro histórico:",
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

    async (req, res) => {

        try {

            const clienteId =
                Number(
                    req.params.id
                );


            const {

                nome,
                cpf,
                nascimento,
                endereco,
                valor_devido

            } = req.body;


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


            if (

                !nome ||
                !cpf ||
                !nascimento ||
                !endereco ||
                valor_devido === undefined

            ) {

                return res.status(400).json({

                    sucesso: false,

                    erro:
                        "Preencha todos os campos obrigatórios"

                });

            }


            const valor =
                Number(
                    valor_devido
                );


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


            const resultado =
                await pool.query(

                    `
                    UPDATE clientes_financeiro

                    SET

                        nome = $1,

                        cpf = $2,

                        nascimento = $3,

                        endereco = $4,

                        valor_devido = $5


                    WHERE

                        id = $6

                    AND

                        usuario_id = $7


                    RETURNING *
                    `,

                    [

                        nome.trim(),

                        cpf.trim(),

                        nascimento,

                        endereco.trim(),

                        valor,

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
                    "Cliente atualizado com sucesso!",

                cliente:
                    resultado.rows[0]

            });

        } catch (erro) {

            console.error(
                "Erro ao editar cliente:",
                erro.message
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

    () => {

        console.log(
            "===================================="
        );

        console.log(
            "SERVIDOR RODANDO!"
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "===================================="
        );

    }

);
