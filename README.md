# Prática 1 — Assistente de IA com RAG para a NovaTech

Exercícios práticos das **Semana 1** e **Semana 2** do programa de formação AI First, cobrindo fundamentos de IA Generativa, Engenharia de Prompt, Engenharia de Contexto, RAG e estruturação de projetos AI First.

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
├── semana-1/
│   ├── FAQ-atendimento.md   # FAQ-Atendimento — Perguntas Frequentes do Time de Suporte
│   ├── POL-001-politica-devolucao.md   # POL-001 — Política de Devolução de Mercadorias
│   ├── PROC-042-frete-especial-v1.md   # PROC-042 — Procedimento de Cálculo de Frete Especial
│   ├── PROC-042-v2-frete-especial-revisado.md   # PROC-042-v2 — Procedimento de Cálculo de Frete Especial (Revisado)
│   ├── SLA-2024-tabela-sla-clientes.md   # SLA-2024 — Tabela de SLA por Tipo de Cliente
│   ├── anexo-a-documentacao-simulada-novatech.md   # Anexo A — Documentação Simulada da NovaTech
│   ├── anexo-b-chunks-referencia-rag.md   # Anexo B — Chunks de Referência do Pipeline de RAG
│   ├── exercicio-fase-1-entendimento.md   # Cenário-Âncora 1 — Fase de Entendimento e Contexto
│   ├── tech-lead-exercicio-1.1-prompt.md   # Prompt — Tech Lead | Exercício 1.1 — ADRs Arquiteturais
│   ├── tech-lead-exercicio-1.2-prompt.md   # Prompt — Tech Lead | Exercício 1.2 — Prompt Engineering como Artefato de Arquitetura
│   ├── tech-lead-exercicio-1.3-prompt.md   # Prompt — Tech Lead | Exercício 1.3 — Revisão Crítica de Proposta de RAG
│   ├── exercicios/
│   │   ├── 1.1/
│   │   │   └── resolucao1-1.md   # Resolução — Prática 1.1: ADRs para Assistente RAG NovaTech
│   │   ├── 1.2/
│   │   │   ├── historico-conversas.md   # Histórico de Conversas — Tech Lead | Exercício 1.2
│   │   │   └── test_prompt.py
│   │   └── 1.3/
│   │       └── historico-conversas.md   # Histórico de Conversas — Tech Lead | Exercício 1.3
│   └── skills-avaliacao/
│       ├── cenario-1-avaliacao-delivery-manager.md   # Skill de Avaliação — Delivery Manager (Cenário 1)
│       ├── cenario-1-avaliacao-desenvolvedor.md   # Skill de Avaliação — Desenvolvedor (Cenário 1)
│       ├── cenario-1-avaliacao-foundation.md   # Skill de Avaliação — Foundation
│       ├── cenario-1-avaliacao-product-specialist.md   # Skill de Avaliação — Product Specialist (Cenário 1)
│       ├── cenario-1-avaliacao-qa.md   # Skill de Avaliação — QA (Cenário 1)
│       ├── cenario-1-avaliacao-tech-lead.md   # Skill de Avaliação — Tech Lead (Cenário 1)
│       └── cenario-1-prompt-avaliacao.md   # Prompt Padrão de Avaliação — Trilha AI First DGS
└── semana-2/
    ├── exercicio-2-fase-estruturacao.md   # Cenário-Âncora 2 — Fase de Estruturação do Trabalho
    └── skills-avaliacao/
        ├── avaliacao-delivery-manager.md   # Skill de Avaliação — Delivery Manager (Cenário 2)
        ├── avaliacao-desenvolvedor.md   # Skill de Avaliação — Desenvolvedor (Cenário 2)
        ├── avaliacao-foundation.md   # Skill de Avaliação — Foundation (Cenário 2)
        ├── avaliacao-product-specialist.md   # Skill de Avaliação — Product Specialist (Cenário 2)
        ├── avaliacao-qa.md   # Skill de Avaliação — QA (Cenário 2)
        ├── avaliacao-tech-lead.md   # Skill de Avaliação — Tech Lead (Cenário 2)
        └── prompt-avaliacao.md   # Prompt Padrão de Avaliação — Trilha AI First DGS (Cenário 2)
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
