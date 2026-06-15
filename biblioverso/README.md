# Biblioverso

Rede social simples para leitores publicarem depoimentos sobre livros.

## Como rodar

Abra o terminal nesta pasta e execute:

```bash
python server.py
```

Depois acesse:

```text
http://localhost:8000
```

## Estrutura

- `server.py`: backend em Python puro, usando `http.server`.
- `index.html`: estrutura da tela.
- `styles.css`: visual do app.
- `app.js`: interacao do frontend com a API.
- `data.json`: criado automaticamente quando o servidor roda.

## Rotas do backend

- `GET /api/reviews`: lista os depoimentos.
- `POST /api/reviews`: cria um novo depoimento.
- `POST /api/reviews/<id>/like`: adiciona uma curtida.
- `DELETE /api/reviews/<id>`: remove um depoimento pelo painel admin.

## Login nesta primeira versão

O login ainda é simulado no navegador. Escolha um nome e o tipo de acesso:

- `Leitor`: pode publicar e curtir depoimentos.
- `Administrador`: pode acessar o painel admin e remover depoimentos.

Para entrar como administrador nesta versão:

```text
Senha: admin123
```

Em uma próxima versão, o login pode virar cadastro real com senha e banco de dados.

## Recursos adicionados

- Ranking de livros mais comentados.
- Lista `quero ler`.
- Desafios de leitura.
- Recomendações baseadas nos livros curtidos.
- Clubes de leitura.
- Visual mais claro com verde suave e animações nos cliques.
