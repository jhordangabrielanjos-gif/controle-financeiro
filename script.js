const API_URL = window.location.origin;

// ==========================================
// TROCAR TELAS
// ==========================================

function mostrarCadastro() {

document
    .getElementById("loginCard")
    .classList.add("escondido");

document
    .getElementById("cadastroCard")
    .classList.remove("escondido");

}

function mostrarLogin() {

document
    .getElementById("cadastroCard")
    .classList.add("escondido");

document
    .getElementById("loginCard")
    .classList.remove("escondido");

}

// ==========================================
// CADASTRAR USUÁRIO
// ==========================================

document
.getElementById("formCadastro")
.addEventListener("submit", async function (event) {

    event.preventDefault();


    const nome =
        document.getElementById(
            "cadastroNome"
        ).value;


    const email =
        document.getElementById(
            "cadastroEmail"
        ).value;


    const senha =
        document.getElementById(
            "cadastroSenha"
        ).value;


    try {

        const resposta = await fetch(
            `${API_URL}/usuarios/cadastro`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    nome,
                    email,
                    senha
                })
            }
        );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            alert(
                dados.erro ||
                "Erro ao criar conta"
            );

            return;

        }


        alert(
            "Conta criada com sucesso!"
        );


        document
            .getElementById(
                "formCadastro"
            )
            .reset();


        mostrarLogin();


    } catch (erro) {

        console.error(erro);

        alert(
            "Não foi possível conectar ao servidor"
        );

    }

});

// ==========================================
// LOGIN
// ==========================================

document
.getElementById("formLogin")
.addEventListener("submit", async function (event) {

    event.preventDefault();


    const email =
        document.getElementById(
            "loginEmail"
        ).value;


    const senha =
        document.getElementById(
            "loginSenha"
        ).value;


    try {

        const resposta = await fetch(
            `${API_URL}/usuarios/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    email,
                    senha
                })
            }
        );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            alert(
                dados.erro ||
                "Erro ao fazer login"
            );

            return;

        }


        // SALVAR TOKEN

        localStorage.setItem(
            "tokenFinanceiro",
            dados.token
        );


        localStorage.setItem(
            "usuarioFinanceiro",
            JSON.stringify(
                dados.usuario
            )
        );


        alert(
            "Login realizado com sucesso!"
        );


        // IR PARA O PAINEL

        window.location.href =
            "painel.html";


    } catch (erro) {

        console.error(erro);

        alert(
            "Não foi possível conectar ao servidor"
        );

    }

});
