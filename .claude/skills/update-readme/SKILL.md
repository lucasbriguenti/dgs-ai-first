---
name: update-readme
description: Atualiza o README.md para refletir a estrutura atual do repositório. Use quando novas semanas, exercícios ou resoluções forem adicionados. Reconstrói o parágrafo de introdução e a seção "Estrutura do Repositório".
---

Este repositório de exercícios AI First cresce a cada semana (`semana-1/`, `semana-2/`, …). O script `driver.py` detecta automaticamente as pastas `semana-N/` presentes, reconstrói a árvore de arquivos com os títulos extraídos dos próprios markdowns e atualiza o `README.md`.

## Pré-requisitos

Python 3 (sem dependências externas).

## Executar

```bash
# aplica as alterações no README.md
python3 .claude/skills/update-readme/driver.py

# apenas mostra o que mudaria, sem gravar
python3 .claude/skills/update-readme/driver.py --dry-run
```

## O que é atualizado

| Seção | Critério de atualização |
|-------|------------------------|
| Parágrafo de introdução | Lista as semanas presentes no repo |
| Estrutura do Repositório | Árvore completa de `semana-N/` com títulos dos `.md` |

Seções não tocadas: `## Cenário`, `## Exercícios por Papel`, `## Conceitos-Chave Abordados`, `## Ferramentas Utilizadas` — essas requerem edição manual porque têm conteúdo curado.

## Quando rodar

- Ao adicionar uma nova pasta `semana-N/`
- Ao adicionar novos arquivos de exercício, resolução ou avaliação dentro de uma semana existente
- Após reorganizar arquivos dentro das pastas de semana
