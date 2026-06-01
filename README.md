# Prática 1 — Assistente de IA com RAG para a NovaTech

Exercícios práticos da **Semana 1** do programa de formação AI First, focados em fundamentos de IA Generativa, Engenharia de Prompt, Engenharia de Contexto e RAG (Retrieval-Augmented Generation).

## Cenário

A **NovaTech** é uma empresa de logística com 1.200 funcionários que contratou a DB1 para construir um assistente de IA integrado ao Microsoft Teams. O assistente responde perguntas de 45 atendentes (320 chamados/dia) em linguagem natural, com base na documentação interna da empresa espalhada em:

| Fonte | Qtde | Formato | Atualização |
|-------|------|---------|-------------|
| SharePoint | ~800 docs | PDF, DOCX | Mensal |
| Confluence | ~400 páginas | HTML/Wiki | Semanal |
| Pasta de rede | ~50 planilhas | XLSX | Mensal |

**Meta:** Reduzir o tempo médio de busca de 12 para menos de 2 minutos por chamado em 3 meses.

## Estrutura do Repositório

```
.
├── exercicio-fase-1-entendimento.md   # Descrição completa dos exercícios por papel
├── anexo-a-documentacao-simulada-novatech.md  # Documentação simulada da NovaTech
├── anexo-b-chunks-referencia-rag.md           # Chunks de referência e mapa de cobertura RAG
│
├── Documentos da NovaTech (base de conhecimento)
│   ├── POL-001-politica-devolucao.md
│   ├── SLA-2024-tabela-sla-clientes.md
│   ├── PROC-042-frete-especial-v1.md
│   ├── PROC-042-v2-frete-especial-revisado.md
│   └── FAQ-atendimento.md
│
├── Prompts dos exercícios (Tech Lead)
│   ├── tech-lead-exercicio-1.1-prompt.md   # ADRs Arquiteturais
│   ├── tech-lead-exercicio-1.2-prompt.md   # Prompt Engineering como Artefato
│   └── tech-lead-exercicio-1.3-prompt.md   # Revisão Crítica de Proposta de RAG
│
├── Critérios de avaliação por papel
│   └── skills-avaliacao/
│       ├── cenario-1-prompt-avaliacao.md
│       ├── cenario-1-avaliacao-tech-lead.md
│       ├── cenario-1-avaliacao-desenvolvedor.md
│       ├── cenario-1-avaliacao-product-specialist.md
│       ├── cenario-1-avaliacao-delivery-manager.md
│       ├── cenario-1-avaliacao-qa.md
│       └── cenario-1-avaliacao-foundation.md
│
└── Resoluções
    └── exercicios/
        ├── 1.1/resolucao1-1.md          # ADRs + Devil's Advocate
        ├── 1.2/historico-conversas.md   # Prompt Engineering
        ├── 1.2/test_prompt.py           # Script de teste automatizado
        └── 1.3/historico-conversas.md   # Revisão crítica de proposta RAG
```

## Exercícios por Papel

### Tech Lead
| Exercício | Tema | Ferramentas |
|-----------|------|-------------|
| 1.1 | ADRs Arquiteturais (LLM, Contexto, Contradições, Build vs Buy) | Claude |
| 1.2 | Prompt Engineering como artefato versionado + script de testes | Claude + GitHub Copilot |
| 1.3 | Revisão crítica de proposta de RAG de desenvolvedor júnior | Claude |

### Desenvolvedor
| Exercício | Tema | Ferramentas |
|-----------|------|-------------|
| 1.1 | Análise de viabilidade técnica com fundamentos de LLM | Claude |
| 1.2 | Prototipação de system prompt com engenharia de contexto | Claude |
| 1.3 | Pipeline de RAG funcional com stack open-source | Claude + GitHub Copilot |

### Product Specialist
| Exercício | Tema | Ferramentas |
|-----------|------|-------------|
| 1.1 | Mapeamento de intent com progressive disclosure | Claude |
| 1.2 | Design de jornada do atendente com o assistente | Claude + Claude Design |
| 1.3 | Especificação de requisitos de RAG do ponto de vista de produto | Claude |

### Delivery Manager
| Exercício | Tema | Ferramentas |
|-----------|------|-------------|
| 1.1 | Avaliação de viabilidade e riscos com fundamentos de IA | Claude |
| 1.2 | Comunicação de expectativas com o cliente | Claude + Claude Cowork |
| 1.3 | Planejamento de discovery com fase de Intent | Claude + Claude Cowork |

### QA
| Exercício | Tema | Ferramentas |
|-----------|------|-------------|
| 1.1 | Identificação de cenários de falha de IA (alucinação, context rot) | Claude |
| 1.2 | Design de critérios de aceitação para respostas de IA | Claude + Claude Cowork |
| 1.3 | Plano de testes para pipeline de RAG | Claude + Claude Cowork |

## Conceitos-Chave Abordados

- **RAG (Retrieval-Augmented Generation):** pipeline de ingestão, chunking, embeddings, vector store e geração
- **Engenharia de Contexto:** orçamento de atenção, progressive disclosure, context rot, lost in the middle
- **ADRs:** documentação de decisões arquiteturais com trade-offs explícitos
- **Prompt Engineering como código:** versionamento, testes automatizados, enforcement probabilístico vs determinístico
- **Documentos contraditórios:** PROC-042 v1 vs v2 como caso concreto de gestão de versões no RAG

## Ferramentas Utilizadas

- **Claude** (chat) — todos os papéis
- **GitHub Copilot** — Desenvolvedor e Tech Lead
- **Claude Cowork** — Delivery Manager, Product Specialist, QA
- **Claude Design** — Product Specialist
