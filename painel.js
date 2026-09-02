const API_URL = window.location.origin;

let clienteAtual = null;
let todosClientes = [];
let filtroAtual = "todos";
let dadosRelatorio = null;
let cobrancaAtual = null;

let valorCobrancaAtual = 0;

// ==========================================
// VERIFICAR LOGIN
// ==========================================

const token = localStorage.getItem(
    "tokenFinanceiro"
);

const usuario = JSON.parse(
    localStorage.getItem(
        "usuarioFinanceiro"
    )
);

if (!token || !usuario) {
    window.location.href = "index.html";
}

// ==========================================
// MOSTRAR USUÁRIO
// ==========================================

const nomeUsuario =
    document.getElementById(
        "nomeUsuario"
    );

if (nomeUsuario) {
    nomeUsuario.textContent =
        `Olá, ${usuario.nome}`;
}

// ==========================================
// SAIR
// ==========================================

function sair() {

    localStorage.removeItem(
        "tokenFinanceiro"
    );

    localStorage.removeItem(
        "usuarioFinanceiro"
    );

    window.location.href =
        "index.html";

}

// ==========================================
// FORMATAR DATA PARA INPUT
// ==========================================

function formatarDataParaInput(data) {

    if (!data) {
        return "";
    }

    return String(data)
        .split("T")[0];

}

// ==========================================
// FORMATAR DATA SIMPLES
// ==========================================

function formatarDataSimples(data) {

    if (!data) {
        return "Não informado";
    }

    const partes =
        String(data)
            .split("T")[0]
            .split("-");

    if (partes.length !== 3) {
        return data;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}

// ==========================================
// CADASTRAR CLIENTE
// ==========================================

document
    .getElementById("formCliente")
    ?.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const nome =
                document.getElementById(
                    "clienteNome"
                ).value;

            const cpf =
                document.getElementById(
                    "clienteCpf"
                ).value;

            const nascimento =
                document.getElementById(
                    "clienteNascimento"
                ).value;

            const rua =
    document.getElementById(
        "clienteRua"
    ).value;

const numero =
    document.getElementById(
        "clienteNumero"
    ).value;

const bairro =
    document.getElementById(
        "clienteBairro"
    ).value;

const cidade =
    document.getElementById(
        "clienteCidade"
    ).value;

const estado =
    document.getElementById(
        "clienteEstado"
    ).value;

            const valor_devido =
                document.getElementById(
                    "clienteValor"
                ).value;

            const valor_semanal =
                document.getElementById(
                    "clienteValorSemanal"
                ).value;

            const dia_pagamento =
                document.getElementById(
                    "clienteDiaPagamento"
                ).value;

            const campoDocumento =
                document.getElementById(
                    "clienteDocumento"
                );

            const campoFotoRosto =
    document.getElementById(
        "clienteFotoRosto"
    );    

            // ==================================
            // CRIAR FORM DATA
            // ==================================

            const formulario =
                new FormData();

            formulario.append(
                "nome",
                nome
            );

            formulario.append(
                "cpf",
                cpf
            );

            formulario.append(
                "nascimento",
                nascimento
            );

            formulario.append(
    "rua",
    rua
);

formulario.append(
    "numero",
    numero
);

formulario.append(
    "bairro",
    bairro
);

formulario.append(
    "cidade",
    cidade
);

formulario.append(
    "estado",
    estado
);

            formulario.append(
                "valor_devido",
                valor_devido
            );

            formulario.append(
                "valor_semanal",
                valor_semanal
            );

            formulario.append(
                "dia_pagamento",
                dia_pagamento
            );

            // ==================================
            // ADICIONAR FOTO
            // ==================================

            if (
                campoDocumento &&
                campoDocumento.files.length > 0
            ) {

                formulario.append(
                    "documento",
                    campoDocumento.files[0]
                );

            }

// ==================================
// ADICIONAR FOTO DO ROSTO
// ==================================

if (
    campoFotoRosto &&
    campoFotoRosto.files.length > 0
) {

    formulario.append(
        "foto_rosto",
        campoFotoRosto.files[0]
    );

}

            try {

                const resposta =
                    await fetch(
                        `${API_URL}/clientes`,
                        {

                            method:
                                "POST",

                            headers: {

                                "Authorization":
                                    `Bearer ${token}`

                            },

                            body:
                                formulario

                        }
                    );

                const texto =
                    await resposta.text();

                let dados;

                try {

                    dados =
                        JSON.parse(
                            texto
                        );

                } catch {

                    console.error(
                        "Resposta do servidor:",
                        texto
                    );

                    throw new Error(
                        "O servidor não retornou uma resposta válida."
                    );

                }

                if (
                    !resposta.ok ||
                    !dados.sucesso
                ) {

                    alert(
                        dados.erro ||
                        "Erro ao cadastrar cliente"
                    );

                    return;

                }

                alert(
                    "Cliente cadastrado com sucesso!"
                );

                document
                    .getElementById(
                        "formCliente"
                    )
                    .reset();

                await carregarClientes();

            } catch (erro) {

                console.error(
                    "Erro cadastro:",
                    erro
                );

                alert(
                    erro.message ||
                    "Erro ao conectar ao servidor"
                );

            }

        }
    );

// ==========================================
// CARREGAR CLIENTES
// ==========================================

async function carregarClientes() {

    const lista =
        document.getElementById(
            "listaClientes"
        );

    if (!lista) {
        return;
    }

    lista.innerHTML =
        "<p>Carregando...</p>";

    try {

        const resposta =
            await fetch(
                `${API_URL}/clientes`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const dados =
            await resposta.json();

        if (!dados.sucesso) {

            lista.innerHTML =
                `<p>${dados.erro || "Erro ao carregar clientes."}</p>`;

            return;
        }

        todosClientes =
            dados.clientes || [];

        console.log(
    "CLIENTES RECEBIDOS:",
    JSON.stringify(
        todosClientes,
        null,
        2
    )
);

        atualizarDashboard(
            todosClientes
        );

        aplicarFiltros();

    } catch (erro) {

        console.error(erro);

        lista.innerHTML =
            "<p>Erro ao carregar clientes.</p>";

    }

}

// ==========================================
// FILTRAR CLIENTES
// ==========================================

function filtrarClientes(filtro) {

    filtroAtual = filtro;

    document
        .querySelectorAll(
            ".btn-filtro"
        )
        .forEach(
            (botao) => {

                botao.classList.remove(
                    "ativo"
                );

            }
        );

    const botoes = {
        todos: "filtroTodos",
        pendentes: "filtroPendentes",
        quitados: "filtroQuitados"
    };

    const botaoAtivo =
        document.getElementById(
            botoes[filtro]
        );

    if (botaoAtivo) {

        botaoAtivo.classList.add(
            "ativo"
        );

    }

    aplicarFiltros();

}

// ==========================================
// PESQUISA E FILTROS
// ==========================================

function aplicarFiltros() {

    const campoPesquisa =
        document.getElementById(
            "pesquisaCliente"
        );

    const pesquisa =
        campoPesquisa
            ? campoPesquisa.value
                .toLowerCase()
                .trim()
            : "";

    const pesquisaCpf =
        pesquisa.replace(
            /\D/g,
            ""
        );

    const clientesFiltrados =
        todosClientes.filter(
            (cliente) => {

                const nome =
                    String(
                        cliente.nome || ""
                    )
                    .toLowerCase();

                const cpf =
                    String(
                        cliente.cpf || ""
                    )
                    .replace(
                        /\D/g,
                        ""
                    );

                const saldo =
                    Number(
                        cliente.saldo_restante
                    ) || 0;

                const correspondePesquisa =
                    nome.includes(pesquisa) ||
                    cpf.includes(pesquisaCpf);

                let correspondeFiltro =
                    true;

                if (
                    filtroAtual ===
                    "pendentes"
                ) {

                    correspondeFiltro =
                        saldo > 0;

                }

                if (
                    filtroAtual ===
                    "quitados"
                ) {

                    correspondeFiltro =
                        saldo <= 0;

                }

                return (
                    correspondePesquisa &&
                    correspondeFiltro
                );

            }
        );

    mostrarClientes(
        clientesFiltrados
    );

}

// ==========================================
// FORMATAR DIA DA SEMANA
// ==========================================

function formatarDiaPagamento(dia) {

    const dias = [
        "Domingo",
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado"
    ];

    return dias[Number(dia)] ||
        "Não informado";

}

// ==========================================
// MOSTRAR CLIENTES
// ==========================================

function mostrarClientes(clientes) {

    const lista =
        document.getElementById(
            "listaClientes"
        );

    if (!lista) {
        return;
    }

    if (clientes.length === 0) {

        lista.innerHTML =
            "<p>Nenhum cliente encontrado.</p>";

        return;
    }

    lista.innerHTML =
        clientes.map(
            (cliente) => {

                const nomeSeguro =
                    String(
                        cliente.nome || ""
                    )
                    .replace(
                        /\\/g,
                        "\\\\"
                    )
                    .replace(
                        /'/g,
                        "\\'"
                    );

                return `

                    <div class="cliente-item">

    <div class="cliente-cabecalho">

        <div
            class="foto-cliente-container"
            onclick="verFotoRosto(${cliente.id})"
        >

            ${
                cliente.possui_foto_rosto
                    ? `
                        <img
                            id="foto-rosto-${cliente.id}"
                            class="foto-cliente"
                            src=""
                            alt="Foto de ${cliente.nome || "Cliente"}"
                        >
                    `
                    : `
                        <div class="foto-cliente-sem-foto">
                            👤
                        </div>
                    `
            }

        </div>

        <div class="cliente-informacoes">

            <h3>
                ${cliente.nome || "Sem nome"}
            </h3>

                            ${
                                cliente.possui_documento
                                    ? `
                                        <button
                                            class="btn-documento"
                                            onclick="verDocumento(${cliente.id})"
                                        >
                                            📷 Ver documento
                                        </button>
                                    `
                                    : `
                                        <p class="sem-documento">
                                            📄 Sem documento
                                        </p>
                                    `
                            }

                            <p>
                                <strong>CPF:</strong>
                                ${cliente.cpf || "Não informado"}
                            </p>

                            <p>
                                🎂
                                <strong>Nascimento:</strong>

                                ${
                                    cliente.nascimento
                                        ? formatarDataSimples(
                                            cliente.nascimento
                                        )
                                        : "Não informado"
                                }
                            </p>

                            ${
                                Number(cliente.saldo_restante) > 0
                                    ? `
                                        <p>
                                            <strong>
                                                Saldo restante:
                                            </strong>

                                            <strong>
                                                ${formatarMoeda(
                                                    cliente.saldo_restante
                                                )}
                                            </strong>
                                        </p>
                                    `
                                    : `
                                        <p>
                                            <strong class="cliente-quitado">
                                                ✅ Cliente quitado
                                            </strong>
                                        </p>
                                    `
                            }

                            <p>
                                <strong>
                                    📅 Pagamento semanal:
                                </strong>

                                ${formatarMoeda(
                                    cliente.valor_semanal
                                )}
                            </p>

                            <p>
                                <strong>
                                    📆 Dia:
                                </strong>

                                ${formatarDiaPagamento(
                                    cliente.dia_pagamento
                                )}
                            </p>

                        </div>

                        <div class="acoes-cliente">

                            <button
                                class="btn-pagamento"
                                onclick="abrirPagamento(
                                    ${cliente.id},
                                    '${nomeSeguro}'
                                )"
                            >
                                💰 Pagamento
                            </button>

                            <button
                                class="btn-localizacao"
                                onclick="abrirLocalizacaoPorId(${cliente.id})"
                            >
                                📍 Localização
                            </button>

                            <button
                                class="btn-quitar"
                                onclick="abrirModalQuitarDivida(${cliente.id})"
                            >
                                ✅ Quitar dívida
                            </button>

                            <button
                                class="btn-editar"
                                onclick="abrirEditar(${cliente.id})"
                            >
                                ✏️ Editar
                            </button>

                            <button
                                class="btn-excluir"
                                onclick="excluirCliente(
                                    ${cliente.id},
                                    '${nomeSeguro}'
                                )"
                            >
                                🗑️ Excluir
                            </button>

                        </div>

                    </div>

                `;

            }
        )
        .join("");

// ==================================
// CARREGAR FOTOS
// ==================================

carregarFotosRosto(
    clientes
);

}

// ==========================================
// VER FOTO DO ROSTO
// ==========================================

async function verFotoRosto(clienteId) {

    try {

        const resposta =
            await fetch(
                `${API_URL}/clientes/${clienteId}/foto`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        if (!resposta.ok) {

            const erro =
                await resposta.json();

            alert(
                erro.erro ||
                "Erro ao carregar foto"
            );

            return;

        }


        const blob =
            await resposta.blob();


        if (
            !blob.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "O arquivo salvo não é uma imagem válida."
            );

            return;

        }


        const imagemURL =
            URL.createObjectURL(
                blob
            );


        document.getElementById(
            "imagemFotoRosto"
        ).src =
            imagemURL;


        document.getElementById(
            "modalFotoRosto"
        ).style.display =
            "flex";


    } catch (erro) {

        console.error(
            erro
        );

        alert(
            "Erro ao carregar foto."
        );

    }

}

// ==========================================
// CARREGAR FOTOS DOS CLIENTES
// ==========================================

async function carregarFotosRosto(
    clientes
) {

    for (
        const cliente of clientes
    ) {

        if (
            !cliente.possui_foto_rosto
        ) {
            continue;
        }


        const imagem =
            document.getElementById(
                `foto-rosto-${cliente.id}`
            );


        if (!imagem) {
            continue;
        }


        try {

            const resposta =
                await fetch(

                    `${API_URL}/clientes/${cliente.id}/foto`,

                    {

                        headers: {

                            "Authorization":
                                `Bearer ${token}`

                        }

                    }

                );


            if (!resposta.ok) {
                continue;
            }


            const arquivo =
                await resposta.blob();


            const url =
                URL.createObjectURL(
                    arquivo
                );


            imagem.src =
                url;


        } catch (erro) {

            console.error(
                "Erro ao carregar foto do cliente:",
                erro
            );

        }

    }

}

// ==========================================
// PESQUISAR CLIENTES
// ==========================================

function pesquisarClientes() {

    aplicarFiltros();

}

// ==========================================
// ABRIR EDITAR CLIENTE
// ==========================================

function abrirEditar(clienteId) {

    const cliente =
        todosClientes.find(
            (item) =>
                Number(item.id) ===
                Number(clienteId)
        );

    if (!cliente) {

        alert(
            "Cliente não encontrado"
        );

        return;
    }

    document.getElementById(
        "editarClienteId"
    ).value =
        cliente.id;

    document.getElementById(
        "editarClienteNome"
    ).value =
        cliente.nome || "";

    document.getElementById(
        "editarClienteCpf"
    ).value =
        cliente.cpf || "";

    document.getElementById(
        "editarClienteNascimento"
    ).value =
        formatarDataParaInput(
            cliente.nascimento
        );

    document.getElementById(
    "editarClienteRua"
).value =
    cliente.rua || "";

document.getElementById(
    "editarClienteNumero"
).value =
    cliente.numero || "";

document.getElementById(
    "editarClienteBairro"
).value =
    cliente.bairro || "";

document.getElementById(
    "editarClienteCidade"
).value =
    cliente.cidade || "";

document.getElementById(
    "editarClienteEstado"
).value =
    cliente.estado || "";    

    document.getElementById(
        "editarClienteValor"
    ).value =
        cliente.valor_devido || 0;

     document.getElementById(
    "editarClienteValorSemanal"
).value =
    cliente.valor_semanal || "";

document.getElementById(
    "editarClienteDiaPagamento"
).value =
    cliente.dia_pagamento ?? "";   

    document.getElementById(
        "modalEditar"
    ).classList.remove(
        "escondido"
    );

}

// ==========================================
// SALVAR EDIÇÃO
// ==========================================

async function salvarEdicao(event) {

    event.preventDefault();

    const clienteId =
        document.getElementById(
            "editarClienteId"
        ).value;


    const nome =
        document.getElementById(
            "editarClienteNome"
        ).value;


    const cpf =
        document.getElementById(
            "editarClienteCpf"
        ).value;


    const nascimento =
        document.getElementById(
            "editarClienteNascimento"
        ).value;


    const rua =
    document.getElementById(
        "editarClienteRua"
    ).value
    .trim();

const numero =
    document.getElementById(
        "editarClienteNumero"
    ).value
    .trim();

const bairro =
    document.getElementById(
        "editarClienteBairro"
    ).value
    .trim();

const cidade =
    document.getElementById(
        "editarClienteCidade"
    ).value
    .trim();

const estado =
    document.getElementById(
        "editarClienteEstado"
    ).value;

    const valor_devido =
        document.getElementById(
            "editarClienteValor"
        ).value;


    const valor_semanal =
        document.getElementById(
            "editarClienteValorSemanal"
        ).value;


    const dia_pagamento =
        document.getElementById(
            "editarClienteDiaPagamento"
        ).value;


    try {

        const resposta =
            await fetch(
                `${API_URL}/clientes/${clienteId}`,
                {

                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

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

                    })

                }
            );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            alert(
                dados.erro ||
                "Erro ao editar cliente"
            );

            return;

        }


        alert(
            "Cliente atualizado!"
        );


        fecharEditar();


        carregarClientes();


    } catch (erro) {

        console.error(erro);

        alert(
            "Erro ao conectar ao servidor"
        );

    }

}

// ==========================================
// FECHAR EDITAR
// ==========================================

function fecharEditar() {

    document.getElementById(
        "modalEditar"
    ).classList.add(
        "escondido"
    );

}

// ==========================================
// EXCLUIR CLIENTE
// ==========================================

async function excluirCliente(
    clienteId,
    nome
) {

    const confirmar =
        confirm(
            `Tem certeza que deseja excluir o cliente "${nome}"?\n\nOs pagamentos vinculados a este cliente também serão excluídos.`
        );

    if (!confirmar) {
        return;
    }

    try {

        const resposta =
            await fetch(
                `${API_URL}/clientes/${clienteId}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const dados =
            await resposta.json();

        if (!dados.sucesso) {

            alert(
                dados.erro ||
                "Erro ao excluir cliente"
            );

            return;
        }

        alert(
            "Cliente excluído!"
        );

        carregarClientes();

    } catch (erro) {

        console.error(erro);

        alert(
            "Erro ao conectar ao servidor"
        );

    }

}

// ==========================================
// ABRIR PAGAMENTO
// ==========================================

function abrirPagamento(id, nome) {

    // Salva o ID do cliente selecionado
    clienteAtual = Number(id);

    console.log(
        "Cliente selecionado:",
        clienteAtual
    );

    if (!clienteAtual) {

        alert(
            "Erro ao selecionar o cliente."
        );

        return;

    }

    document.getElementById(
        "clienteSelecionado"
    ).textContent =
        `Cliente: ${nome}`;

    document.getElementById(
        "valorPagamento"
    ).value = "";

    document.getElementById(
        "modalPagamento"
    ).classList.remove(
        "escondido"
    );

    carregarHistorico(
        clienteAtual
    );

}

// ==========================================
// FECHAR PAGAMENTO
// ==========================================

function fecharModal() {

    document.getElementById(
        "modalPagamento"
    ).classList.add(
        "escondido"
    );

    clienteAtual = null;

}

// ==========================================
// REGISTRAR PAGAMENTO
// ==========================================

async function registrarPagamento() {

    if (
    clienteAtual === null ||
    clienteAtual === undefined
) {

    alert(
        "Nenhum cliente selecionado"
    );

    return;

}

    const confirmar =
        confirm(
            "Confirmar o pagamento semanal deste cliente?"
        );

    if (!confirmar) {
        return;
    }

    try {

        const resposta =
            await fetch(
                `${API_URL}/clientes/${clienteAtual}/pagamentos`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const dados =
            await resposta.json();

        if (!dados.sucesso) {

            alert(
                dados.erro ||
                "Erro ao registrar pagamento"
            );

            return;

        }

        alert(
            `Pagamento semanal registrado: ${formatarMoeda(
                dados.valor_pago
            )}`
        );

        await carregarClientes();

        await carregarPagamentosSemanais();

        carregarHistorico(
            clienteAtual
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "Erro ao conectar ao servidor"
        );

    }

}

// ==========================================
// CARREGAR HISTÓRICO
// ==========================================

async function carregarHistorico(
    clienteId
) {

    const historico =
        document.getElementById(
            "historicoPagamentos"
        );

    historico.innerHTML =
        "<p>Carregando histórico...</p>";

    try {

        const resposta =
            await fetch(
                `${API_URL}/clientes/${clienteId}/pagamentos`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const dados =
            await resposta.json();

        if (
            !dados.sucesso ||
            !dados.pagamentos ||
            dados.pagamentos.length === 0
        ) {

            historico.innerHTML =
                "<p>Nenhum pagamento registrado.</p>";

            return;
        }

        historico.innerHTML =
            `
            <h3>Histórico</h3>

            ${dados.pagamentos.map(
                (pagamento) => {

                    return `

                        <div class="pagamento-item">

                            <strong>
                                ${formatarMoeda(
                                    pagamento.valor
                                )}
                            </strong>

                            <span>
                                ${pagamento.data_formatada}
                            </span>

                        </div>

                    `;

                }
            ).join("")}
            `;

    } catch (erro) {

        console.error(erro);

        historico.innerHTML =
            "<p>Erro ao carregar histórico.</p>";

    }

}

// ==========================================
// FORMATAR MOEDA
// ==========================================

function formatarMoeda(valor) {

    return Number(
        valor || 0
    ).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}

// ==========================================
// ATUALIZAR DASHBOARD
// ==========================================

function atualizarDashboard(clientes) {

    let totalDevido = 0;
    let totalRecebido = 0;
    let saldoPendente = 0;

    clientes.forEach(
        (cliente) => {

            totalDevido +=
                Number(
                    cliente.valor_devido
                ) || 0;

            totalRecebido +=
                Number(
                    cliente.total_pago
                ) || 0;

            saldoPendente +=
                Number(
                    cliente.saldo_restante
                ) || 0;

        }
    );

    const elementoTotalDevido =
        document.getElementById(
            "totalDevido"
        );

    const elementoTotalRecebido =
        document.getElementById(
            "totalRecebido"
        );

    const elementoSaldoPendente =
        document.getElementById(
            "saldoPendente"
        );

    const elementoTotalClientes =
        document.getElementById(
            "totalClientes"
        );

    if (elementoTotalDevido) {

        elementoTotalDevido.textContent =
            formatarMoeda(
                totalDevido
            );

    }

    if (elementoTotalRecebido) {

        elementoTotalRecebido.textContent =
            formatarMoeda(
                totalRecebido
            );

    }

    if (elementoSaldoPendente) {

        elementoSaldoPendente.textContent =
            formatarMoeda(
                saldoPendente
            );

    }

    if (elementoTotalClientes) {

        elementoTotalClientes.textContent =
            clientes.length;

    }

}

// ==========================================
// GERAR RELATÓRIO
// ==========================================

async function gerarRelatorio() {

    const inicio =
        document.getElementById(
            "dataInicio"
        ).value;

    const fim =
        document.getElementById(
            "dataFim"
        ).value;

    const lista =
        document.getElementById(
            "listaRelatorio"
        );

    if (!inicio || !fim) {

        alert(
            "Selecione a data inicial e a data final."
        );

        return;
    }

    if (inicio > fim) {

        alert(
            "A data inicial não pode ser maior que a final."
        );

        return;
    }

    lista.innerHTML =
        "<p>Gerando relatório...</p>";

    try {

        const url =
            `${API_URL}/relatorios/pagamentos?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;

        const resposta =
            await fetch(
                url,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const texto =
            await resposta.text();

        let dados;

        try {

            dados =
                JSON.parse(texto);

        } catch {

            throw new Error(
                "O servidor não retornou um JSON válido."
            );

        }

        if (
            !resposta.ok ||
            !dados.sucesso
        ) {

            lista.innerHTML =
                `<p>${dados.erro || "Erro ao gerar relatório."}</p>`;

            return;
        }

        dadosRelatorio =
            dados;

        document.getElementById(
            "relatorioTotal"
        ).textContent =
            formatarMoeda(
                dados.resumo.total_recebido
            );

        document.getElementById(
            "relatorioQuantidade"
        ).textContent =
            dados.resumo.quantidade_pagamentos;

        if (
            !dados.pagamentos ||
            dados.pagamentos.length === 0
        ) {

            lista.innerHTML =
                `
                <p class="sem-relatorio">
                    Nenhum pagamento encontrado
                    neste período.
                </p>
                `;

            return;
        }

        lista.innerHTML =
            `

            <h3>
                📋 Pagamentos do período
            </h3>

            ${dados.pagamentos.map(
                (pagamento) => {

                    return `

                    <div class="item-relatorio">

                        <div>

                            <strong>
                                ${pagamento.cliente_nome}
                            </strong>

                            <span>
                                CPF:
                                ${pagamento.cliente_cpf}
                            </span>

                            <span>
                                ${pagamento.data_formatada}
                            </span>

                        </div>

                        <strong class="valor-relatorio">

                            ${formatarMoeda(
                                pagamento.valor
                            )}

                        </strong>

                    </div>

                    `;

                }
            ).join("")}

            `;

    } catch (erro) {

        console.error(
            "ERRO AO GERAR RELATÓRIO:",
            erro
        );

        lista.innerHTML =
            `
            <p>
                Erro ao gerar relatório:
                ${erro.message}
            </p>
            `;

    }

}

// ==========================================
// DEFINIR DATAS PADRÃO
// ==========================================

function formatarInputData(data) {

    const ano =
        data.getFullYear();

    const mes =
        String(
            data.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const dia =
        String(
            data.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${ano}-${mes}-${dia}`;

}

function definirDatasPadrao() {

    const hoje =
        new Date();

    const primeiroDia =
        new Date(
            hoje.getFullYear(),
            hoje.getMonth(),
            1
        );

    const campoInicio =
        document.getElementById(
            "dataInicio"
        );

    const campoFim =
        document.getElementById(
            "dataFim"
        );

    if (campoInicio) {

        campoInicio.value =
            formatarInputData(
                primeiroDia
            );

    }

    if (campoFim) {

        campoFim.value =
            formatarInputData(
                hoje
            );

    }

}

// ==========================================
// EXPORTAR EXCEL
// ==========================================

function exportarExcel() {

    if (
        !dadosRelatorio ||
        !dadosRelatorio.pagamentos ||
        dadosRelatorio.pagamentos.length === 0
    ) {

        alert(
            "Gere um relatório com pagamentos antes de exportar."
        );

        return;
    }

    const dadosExcel =
        dadosRelatorio.pagamentos.map(
            (pagamento) => {

                return {

                    "Cliente":
                        pagamento.cliente_nome,

                    "CPF":
                        pagamento.cliente_cpf,

                    "Valor":
                        Number(
                            pagamento.valor
                        ),

                    "Data e Hora":
                        pagamento.data_formatada

                };

            }
        );

    const resumo = [

        {
            "Cliente":
                "PERÍODO",

            "CPF":
                `${dadosRelatorio.periodo.inicio} até ${dadosRelatorio.periodo.fim}`,

            "Valor":
                "",

            "Data e Hora":
                ""
        },

        {
            "Cliente":
                "TOTAL RECEBIDO",

            "CPF":
                "",

            "Valor":
                Number(
                    dadosRelatorio.resumo.total_recebido
                ),

            "Data e Hora":
                ""
        },

        {
            "Cliente":
                "QUANTIDADE DE PAGAMENTOS",

            "CPF":
                String(
                    dadosRelatorio.resumo
                        .quantidade_pagamentos
                ),

            "Valor":
                "",

            "Data e Hora":
                ""
        },

        {},

        ...dadosExcel

    ];

    const planilha =
        XLSX.utils.json_to_sheet(
            resumo
        );

    planilha["!cols"] = [

        { wch: 30 },
        { wch: 25 },
        { wch: 15 },
        { wch: 22 }

    ];

    const arquivo =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        arquivo,
        planilha,
        "Relatório"
    );

    XLSX.writeFile(
        arquivo,
        `relatorio_${dadosRelatorio.periodo.inicio}_${dadosRelatorio.periodo.fim}.xlsx`
    );

}

// ==========================================
// EXPORTAR PDF
// ==========================================

function exportarPDF() {

    if (
        !dadosRelatorio ||
        !dadosRelatorio.pagamentos ||
        dadosRelatorio.pagamentos.length === 0
    ) {

        alert(
            "Gere um relatório com pagamentos antes de exportar."
        );

        return;
    }

    const {
        jsPDF
    } =
        window.jspdf;

    const pdf =
        new jsPDF();

    pdf.setFontSize(18);

    pdf.text(
        "Relatório Financeiro",
        14,
        20
    );

    pdf.setFontSize(11);

    pdf.text(
        `Período: ${dadosRelatorio.periodo.inicio} até ${dadosRelatorio.periodo.fim}`,
        14,
        30
    );

    pdf.text(
        `Total recebido: ${formatarMoeda(
            dadosRelatorio.resumo.total_recebido
        )}`,
        14,
        40
    );

    pdf.text(
        `Quantidade de pagamentos: ${dadosRelatorio.resumo.quantidade_pagamentos}`,
        14,
        48
    );

    const linhas =
        dadosRelatorio.pagamentos.map(
            (pagamento) => [

                pagamento.cliente_nome,

                pagamento.cliente_cpf,

                formatarMoeda(
                    pagamento.valor
                ),

                pagamento.data_formatada

            ]
        );

    pdf.autoTable({

        startY: 58,

        head: [
            [
                "Cliente",
                "CPF",
                "Valor",
                "Data e Hora"
            ]
        ],

        body:
            linhas,

        styles: {
            fontSize: 8
        },

        headStyles: {
            fontSize: 9
        }

    });

    pdf.save(
        `relatorio_${dadosRelatorio.periodo.inicio}_${dadosRelatorio.periodo.fim}.pdf`
    );

}

// ==========================================
// FOLHA DE PAGAMENTOS SEMANAIS
// ==========================================

function obterNomeDia(dia) {

    const dias = [
        "Domingo",
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado"
    ];

    return dias[Number(dia)] || "Hoje";

}


// ==========================================
// ESCAPAR TEXTO PARA HTML
// ==========================================

function escaparHtml(texto) {

    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

// ==========================================
// CARREGAR PAGAMENTOS SEMANAIS
// COBRANÇAS DO DIA + ATRASADAS
// ==========================================

async function carregarPagamentosSemanais() {

    const lista =
        document.getElementById(
            "listaPagamentosSemanais"
        );

    if (!lista) {
        return;
    }

    lista.innerHTML =
        "<p>Carregando folha de pagamentos...</p>";

    try {

        const resposta =
            await fetch(
                `${API_URL}/pagamentos-semanais`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        const texto =
            await resposta.text();

        let dados;

        try {

            dados =
                JSON.parse(texto);

        } catch {

            throw new Error(
                "O servidor não retornou um JSON válido."
            );

        }

        if (
            !resposta.ok ||
            !dados.sucesso
        ) {

            lista.innerHTML =
                `<p>${
                    escaparHtml(
                        dados.erro ||
                        "Erro ao carregar pagamentos."
                    )
                }</p>`;

            return;

        }


        // ==================================
        // TÍTULO
        // ==================================

        const titulo =
            document.getElementById(
                "tituloPagamentoSemanal"
            );

        if (titulo) {

            titulo.textContent =
                "Cobranças pendentes e atrasadas";

        }


        // ==================================
        // RESUMO
        // ==================================

        const totalHoje =
            document.getElementById(
                "totalPagamentosHoje"
            );

        const totalPendentes =
            document.getElementById(
                "totalPendentesHoje"
            );

        const totalPagos =
            document.getElementById(
                "totalPagosHoje"
            );


        if (totalHoje) {

            totalHoje.textContent =
                Number(dados.total) || 0;

        }


        if (totalPendentes) {

            totalPendentes.textContent =
                Number(dados.pendentes || 0) +
                Number(dados.atrasados || 0);

        }


        if (totalPagos) {

            totalPagos.textContent =
                Number(dados.quitados) || 0;

        }


        // ==================================
        // SEM COBRANÇAS
        // ==================================

        if (
            !Array.isArray(
                dados.pagamentos
            ) ||
            dados.pagamentos.length === 0
        ) {

            lista.innerHTML =
                `
                <p>
                    🎉 Nenhuma cobrança pendente!
                </p>
                `;

            return;

        }


        // ==================================
        // DATA DE HOJE
        // ==================================

        const hoje =
            dados.data_hoje;


        // ==================================
        // MONTAR LISTA
        // ==================================

        lista.innerHTML =
            dados.pagamentos.map(
                (cobranca) => {


                    const valorOriginal =
                        Number(
                            cobranca.valor_original
                        ) || 0;


                    const juros =
                        Number(
                            cobranca.juros
                        ) || 0;


                    const valorTotal =
                        Number(
                            cobranca.valor_total
                        ) || 0;


                    const saldoRestante =
                        Number(
                            cobranca.saldo_restante
                        ) || 0;


                    const totalPago =
                        Number(
                            cobranca.total_pago
                        ) || 0;


                    const dataCobranca =
                        String(
                            cobranca.data_cobranca
                        ).split("T")[0];


                    // ==========================
                    // CALCULAR DIAS ATRASADOS
                    // ==========================

                    let diasAtrasados =
                        0;


                    if (
                        dataCobranca < hoje
                    ) {

                        const dataInicio =
                            new Date(
                                `${dataCobranca}T00:00:00`
                            );


                        const dataFim =
                            new Date(
                                `${hoje}T00:00:00`
                            );


                        const diferenca =
                            dataFim -
                            dataInicio;


                        diasAtrasados =
                            Math.floor(
                                diferenca /
                                (1000 * 60 * 60 * 24)
                            );

                    }


                    // ==========================
                    // STATUS
                    // ==========================

                    let statusHtml =
                        "";


                    if (
                        cobranca.status ===
                        "quitado"
                    ) {

                        statusHtml =
                            `
                            <span class="status-quitado">
                                ✅ QUITADO
                            </span>
                            `;

                    } else if (
                        cobranca.status ===
                        "parcial"
                    ) {

                        statusHtml =
                            `
                            <span class="status-pendente">
                                🟡 PAGAMENTO PARCIAL
                            </span>
                            `;

                    } else if (
                        dataCobranca < hoje
                    ) {

                        statusHtml =
                            `
                            <span class="status-atrasado">
                                🔴 ATRASADO —
                                ${diasAtrasados}
                                dia${
                                    diasAtrasados !== 1
                                        ? "s"
                                        : ""
                                }
                            </span>
                            `;

                    } else {

                        statusHtml =
                            `
                            <span class="status-pendente">
                                ⏳ PAGAMENTO PENDENTE
                            </span>
                            `;

                    }


                    // ==========================
                    // BOTÕES
                    // ==========================

                    let botoes =
                        "";


                    if (
                        cobranca.status !==
                        "quitado"
                    ) {

                        botoes =
                            `

                           <button
    class="btn-pagamento"
    onclick="abrirModalPagamentoCobranca(
        ${Number(cobranca.cobranca_id)},
        '${String(cobranca.nome || "").replace(/'/g, "\\'")}',
        ${saldoRestante}
    )"
>
    💰 Pagar
</button> 


                            <button
                                class="btn-juros"
                                onclick="adicionarJuros(
                                    ${Number(
                                        cobranca.cobranca_id
                                    )}
                                )"
                            >
                                ➕ Juros
                            </button>

                            `;

                    }


                    // ==========================
                    // RETORNAR HTML
                    // ==========================

                    return `

                        <div
                            class="
                                cliente-item
                                pagamento-semanal-item
                                ${
                                    dataCobranca < hoje
                                        ? "pagamento-atrasado"
                                        : ""
                                }
                            "
                        >

                            <div
                                class="cliente-informacoes"
                            >

                                <h3>
                                    ${escaparHtml(
                                        cobranca.nome
                                    )}
                                </h3>


                                <p>

                                    📅

                                    <strong>
                                        Vencimento:
                                    </strong>

                                    ${formatarDataSimples(
                                        dataCobranca
                                    )}

                                </p>


                                <p>

                                    💰

                                    <strong>
                                        Valor original:
                                    </strong>

                                    ${formatarMoeda(
                                        valorOriginal
                                    )}

                                </p>


                                ${
                                    juros > 0
                                        ? `

                                        <p>

                                            ⚠️

                                            <strong>
                                                Juros:
                                            </strong>

                                            ${formatarMoeda(
                                                juros
                                            )}

                                        </p>

                                        `
                                        : ""
                                }


                                <p>

                                    💵

                                    <strong>
                                        Valor total:
                                    </strong>

                                    <strong>
                                        ${formatarMoeda(
                                            valorTotal
                                        )}
                                    </strong>

                                </p>


                                ${
                                    totalPago > 0
                                        ? `

                                        <p>

                                            ✅

                                            <strong>
                                                Já pago:
                                            </strong>

                                            ${formatarMoeda(
                                                totalPago
                                            )}

                                        </p>

                                        `
                                        : ""
                                }


                                <p>

                                    📉

                                    <strong>
                                        Falta pagar:
                                    </strong>

                                    <strong>
                                        ${formatarMoeda(
                                            saldoRestante
                                        )}
                                    </strong>

                                </p>


                                <p>

                                    ${statusHtml}

                                </p>

                            </div>


                            <div
                                class="acoes-cliente"
                            >

                                ${botoes}

                            </div>

                        </div>

                    `;

                }
            )
            .join("");


    } catch (erro) {

        console.error(
            "Erro ao carregar folha:",
            erro
        );

        lista.innerHTML =
            `
            <p>
                Erro ao carregar folha:
                ${escaparHtml(
                    erro.message
                )}
            </p>
            `;

    }

}

// ==========================================
// QUITAR COBRANÇA
// ==========================================

async function quitarCobranca(
    cobrancaId
) {

    const confirmar =
        confirm(
            "Deseja quitar completamente esta cobrança?"
        );

    if (!confirmar) {
        return;
    }


    try {

        const resposta =
            await fetch(
                `${API_URL}/cobrancas/${cobrancaId}/quitar`,
                {
                    method:
                        "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok ||
            !dados.sucesso
        ) {

            alert(
                dados.erro ||
                "Erro ao quitar cobrança"
            );

            return;

        }


        alert(
            `Cobrança quitada!\n\nValor pago: ${formatarMoeda(
                dados.valor_quitado
            )}`
        );


        await carregarPagamentosSemanais();


    } catch (erro) {

        console.error(
            erro
        );


        alert(
            "Erro ao conectar ao servidor"
        );

    }

}

// ==========================================
// ADICIONAR JUROS EM VALOR FIXO
// ==========================================

async function adicionarJuros(
    cobrancaId
) {

    const valorInformado =
        prompt(
            "Digite o valor do juros em reais.\n\nExemplo: 5 para R$ 5,00"
        );


    if (
        valorInformado === null
    ) {

        return;

    }


    const jurosValor =
        Number(
            String(
                valorInformado
            )
            .replace(
                ",",
                "."
            )
        );


    if (
        Number.isNaN(
            jurosValor
        ) ||
        jurosValor < 0
    ) {

        alert(
            "Digite um valor de juros válido."
        );

        return;

    }


    const confirmar =
        confirm(
            `Aplicar ${formatarMoeda(
                jurosValor
            )} de juros nesta cobrança?`
        );


    if (!confirmar) {

        return;

    }


    try {

        const resposta =
            await fetch(

                `${API_URL}/cobrancas/${cobrancaId}/juros`,

                {

                    method:
                        "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify({

                            juros_valor:
                                jurosValor

                        })

                }

            );


        const dados =
            await resposta.json();


        if (

            !resposta.ok ||

            !dados.sucesso

        ) {

            alert(

                dados.erro ||

                "Erro ao aplicar juros"

            );

            return;

        }


        alert(

            `Juros de ${formatarMoeda(
                jurosValor
            )} aplicado com sucesso!`

        );


        await carregarPagamentosSemanais();


    } catch (erro) {

        console.error(
            erro
        );


        alert(
            "Erro ao conectar ao servidor"
        );

    }

}

// ==========================================
// ABRIR MODAL DE PAGAMENTO DA COBRANÇA
// ==========================================

function abrirModalPagamentoCobranca(
    cobrancaId,
    nome,
    saldoRestante
) {

    cobrancaAtual =
        Number(cobrancaId);

    valorCobrancaAtual =
        Number(saldoRestante) || 0;


    const nomeCliente =
        document.getElementById(
            "nomeClienteCobranca"
        );

    const valorTotal =
        document.getElementById(
            "valorTotalCobranca"
        );


    if (nomeCliente) {

        nomeCliente.textContent =
            `Cliente: ${nome}`;

    }


    if (valorTotal) {

        valorTotal.textContent =
            formatarMoeda(
                valorCobrancaAtual
            );

    }


    document.getElementById(
        "modalPagamentoCobranca"
    ).classList.remove(
        "escondido"
    );

}


// ==========================================
// FECHAR MODAL
// ==========================================

function fecharModalPagamentoCobranca() {

    document.getElementById(
        "modalPagamentoCobranca"
    ).classList.add(
        "escondido"
    );


    cobrancaAtual =
        null;


    valorCobrancaAtual =
        0;

}


// ==========================================
// PAGAR TUDO
// ==========================================

async function pagarTudoCobranca() {

    if (
        !cobrancaAtual ||
        valorCobrancaAtual <= 0
    ) {

        alert(
            "Cobrança inválida."
        );

        return;

    }


    const confirmar =
        confirm(
            `Confirmar pagamento de ${formatarMoeda(
                valorCobrancaAtual
            )}?`
        );


    if (!confirmar) {

        return;

    }


    try {

        const resposta =
            await fetch(
                `${API_URL}/cobrancas/${cobrancaAtual}/quitar`,
                {

                    method:
                        "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok ||
            !dados.sucesso
        ) {

            alert(
                dados.erro ||
                "Erro ao registrar pagamento"
            );

            return;

        }


        alert(
            `Pagamento realizado com sucesso!\n\nValor pago: ${formatarMoeda(
                dados.valor_quitado
            )}`
        );


        fecharModalPagamentoCobranca();


        await carregarPagamentosSemanais();


        await carregarClientes();


    } catch (erro) {

        console.error(
            "Erro ao pagar cobrança:",
            erro
        );


        alert(
            "Erro ao conectar ao servidor"
        );

    }

}

// ==========================================
// VER DOCUMENTO
// ==========================================

async function verDocumento(clienteId) {

    try {

        const resposta =
            await fetch(
                `${API_URL}/clientes/${clienteId}/documento`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        if (!resposta.ok) {

            const erro =
                await resposta.json();

            alert(
                erro.erro ||
                "Erro ao carregar documento"
            );

            return;

        }


        const blob =
            await resposta.blob();


        // VERIFICAR SE É IMAGEM

        if (
            !blob.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "O arquivo salvo não é uma imagem válida."
            );

            return;

        }


        const imagemURL =
            URL.createObjectURL(
                blob
            );


        // ABRIR MODAL

        const modal =
            document.getElementById(
                "modalDocumento"
            );


        const imagem =
            document.getElementById(
                "imagemDocumento"
            );


        imagem.src =
            imagemURL;


        modal.style.display =
            "flex";


        // Liberar memória depois

        imagem.onload =
            () => {

                URL.revokeObjectURL(
                    imagemURL
                );

            };


    } catch (erro) {

        console.error(
            "Erro ao visualizar documento:",
            erro
        );

        alert(
            "Erro ao carregar documento."
        );

    }

}

// ==========================================
// FECHAR DOCUMENTO
// ==========================================

function fecharDocumento() {

    const imagem =
        document.getElementById(
            "imagemDocumento"
        );


    if (imagem) {

        URL.revokeObjectURL(
            imagem.src
        );


        imagem.src =
            "";

    }


    document.getElementById(
        "modalDocumento"
    ).classList.add(
        "escondido"
    );

}

// ==========================================
// QUITAR DÍVIDA TOTAL DO CLIENTE
// ==========================================

let clienteQuitarDivida = null;


// ==========================================
// ABRIR MODAL QUITAR DÍVIDA
// ==========================================

function abrirModalQuitarDivida(clienteId) {

    const cliente =
        todosClientes.find(
            (item) =>
                Number(item.id) ===
                Number(clienteId)
        );

    if (!cliente) {

        alert(
            "Cliente não encontrado."
        );

        return;

    }


    const saldoRestante =
        Number(
            cliente.saldo_restante
        ) || 0;


    if (saldoRestante <= 0) {

        alert(
            "Este cliente já está quitado."
        );

        return;

    }


    clienteQuitarDivida =
        Number(clienteId);


    document.getElementById(
        "nomeClienteQuitarDivida"
    ).textContent =
        `Cliente: ${cliente.nome}`;


    document.getElementById(
        "valorDividaQuitar"
    ).textContent =
        formatarMoeda(
            saldoRestante
        );


    document.getElementById(
        "modalQuitarDivida"
    ).classList.remove(
        "escondido"
    );

}


// ==========================================
// FECHAR MODAL QUITAR DÍVIDA
// ==========================================

function fecharModalQuitarDivida() {

    document.getElementById(
        "modalQuitarDivida"
    ).classList.add(
        "escondido"
    );


    clienteQuitarDivida =
        null;

}


// ==========================================
// CONFIRMAR QUITAÇÃO TOTAL
// ==========================================

async function confirmarQuitarDivida() {

    if (!clienteQuitarDivida) {

        alert(
            "Nenhum cliente selecionado."
        );

        return;

    }


    const cliente =
        todosClientes.find(
            (item) =>
                Number(item.id) ===
                Number(clienteQuitarDivida)
        );


    if (!cliente) {

        alert(
            "Cliente não encontrado."
        );

        return;

    }


    const saldoRestante =
        Number(
            cliente.saldo_restante
        ) || 0;


    if (saldoRestante <= 0) {

        alert(
            "Este cliente já está quitado."
        );

        fecharModalQuitarDivida();

        return;

    }


    const confirmar =
        confirm(
            `Deseja realmente quitar toda a dívida de ${cliente.nome}?\n\n` +
            `Valor a quitar: ${formatarMoeda(saldoRestante)}`
        );


    if (!confirmar) {

        return;

    }


    try {

        const resposta =
            await fetch(
    `${API_URL}/clientes/${clienteQuitarDivida}/quitar-divida`,
    {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    }
)


        const texto =
            await resposta.text();


        let dados;


        try {

            dados =
                JSON.parse(
                    texto
                );

        } catch {

            throw new Error(
                "O servidor não retornou uma resposta válida."
            );

        }


        if (
            !resposta.ok ||
            !dados.sucesso
        ) {

            alert(
                dados.erro ||
                "Erro ao quitar a dívida."
            );

            return;

        }


        alert(
            `✅ Dívida quitada com sucesso!\n\n` +
            `Valor pago: ${formatarMoeda(
                dados.valor_quitado ||
                saldoRestante
            )}`
        );


        fecharModalQuitarDivida();


        await carregarClientes();

        await carregarPagamentosSemanais();


    } catch (erro) {

        console.error(
            "Erro ao quitar dívida:",
            erro
        );


        alert(
            erro.message ||
            "Erro ao conectar ao servidor."
        );

    }

}

function abrirLocalizacao(cliente) {

    const enderecoCompleto = [

        cliente?.rua?.trim(),

        cliente?.numero?.trim(),

        cliente?.bairro?.trim(),

        cliente?.cidade?.trim()

    ]
        .filter(Boolean)
        .join(", ");

    if (!enderecoCompleto) {

        alert(
            "Este cliente não possui endereço cadastrado."
        );

        return;

    }

    const endereco =
        encodeURIComponent(
            enderecoCompleto
        );

    window.open(

        `https://www.google.com/maps/search/?api=1&query=${endereco}`,

        "_blank"

    );

}


function abrirLocalizacaoPorId(clienteId) {

    const cliente =
        todosClientes.find(
            (cliente) =>
                cliente.id === Number(clienteId)
        );

    if (!cliente) {

        alert(
            "Cliente não encontrado."
        );

        return;

    }

    abrirLocalizacao(cliente);

}

// ==========================================
// INICIAR
// ==========================================

definirDatasPadrao();

carregarClientes();

carregarPagamentosSemanais();

gerarRelatorio();
