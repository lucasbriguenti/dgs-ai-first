#!/usr/bin/env python3
"""
Atualiza o README.md para refletir a estrutura atual do repositório.
Reconstrói as seções:
  - Parágrafo de introdução (lista semanas presentes)
  - Estrutura do Repositório (árvore de arquivos)

Uso:
  python driver.py            # aplica as alterações
  python driver.py --dry-run  # mostra o que mudaria, sem gravar
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

IGNORE_FILES = {"CLAUDE.md", ".gitignore", ".DS_Store", "README.md"}
IGNORE_DIRS = {".git", ".claude", "__pycache__", "node_modules"}


def first_heading(path: Path) -> str | None:
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                return re.sub(r"^#+\s*", "", stripped)
    except Exception:
        pass
    return None


def _render_dir(directory: Path, prefix: str, child_prefix: str, depth: int) -> list[str]:
    lines: list[str] = []
    items = sorted(
        [p for p in directory.iterdir() if p.name not in IGNORE_FILES and not p.name.startswith(".")],
        key=lambda p: (p.is_dir(), p.name),
    )
    for j, item in enumerate(items):
        is_last = j == len(items) - 1
        connector = f"{prefix}└──" if is_last else f"{prefix}├──"
        sub_prefix = f"{prefix}    " if is_last else f"{prefix}│   "
        if item.is_dir():
            if item.name in IGNORE_DIRS:
                continue
            lines.append(f"{connector} {item.name}/")
            if depth > 0:
                lines.extend(_render_dir(item, sub_prefix, sub_prefix, depth - 1))
        else:
            heading = first_heading(item) if item.suffix == ".md" else None
            annotation = f"   # {heading}" if heading else ""
            lines.append(f"{connector} {item.name}{annotation}")
    return lines


def build_tree() -> str:
    weeks = sorted(
        [d for d in ROOT.iterdir() if d.is_dir() and re.match(r"^semana-\d+$", d.name)],
        key=lambda d: d.name,
    )
    lines = ["```", "."]
    for i, week in enumerate(weeks):
        is_last = i == len(weeks) - 1
        connector = "└──" if is_last else "├──"
        child_prefix = "    " if is_last else "│   "
        lines.append(f"{connector} {week.name}/")
        lines.extend(_render_dir(week, child_prefix, child_prefix, depth=2))
    lines.append("```")
    return "\n".join(lines)


def build_intro(weeks: list[Path]) -> str:
    nums = [re.search(r"\d+", w.name).group() for w in weeks]  # type: ignore[union-attr]
    if len(nums) == 1:
        semanas_str = f"**Semana {nums[0]}**"
    else:
        partes = [f"**Semana {n}**" for n in nums]
        semanas_str = ", ".join(partes[:-1]) + " e " + partes[-1]
    return (
        f"Exercícios práticos das {semanas_str} do programa de formação AI First, "
        f"cobrindo fundamentos de IA Generativa, Engenharia de Prompt, Engenharia de Contexto, "
        f"RAG e estruturação de projetos AI First."
    )


def update_readme(dry_run: bool = False) -> None:
    readme_path = ROOT / "README.md"
    original = readme_path.read_text(encoding="utf-8")
    content = original

    weeks = sorted(
        [d for d in ROOT.iterdir() if d.is_dir() and re.match(r"^semana-\d+$", d.name)],
        key=lambda d: d.name,
    )

    # 1. Atualiza parágrafo de introdução (uma linha entre o H1 e o primeiro ## )
    new_intro = build_intro(weeks)
    content = re.sub(
        r"(# [^\n]+\n\n)[^\n]+(\n\n##)",
        r"\g<1>" + new_intro + r"\2",
        content,
        count=1,
    )

    # 2. Atualiza seção Estrutura do Repositório
    new_tree = build_tree()
    content = re.sub(
        r"(## Estrutura do Repositório\n\n)```.*?```",
        lambda m: m.group(1) + new_tree,
        content,
        count=1,
        flags=re.DOTALL,
    )

    if content == original:
        print("README.md já está atualizado — nenhuma alteração necessária.")
        return

    if dry_run:
        orig_lines = original.splitlines()
        new_lines = content.splitlines()
        changed = False
        for i, (a, b) in enumerate(zip(orig_lines, new_lines)):
            if a != b:
                print(f"L{i+1:3d} - {a}")
                print(f"L{i+1:3d} + {b}")
                changed = True
        if len(new_lines) > len(orig_lines):
            for i, line in enumerate(new_lines[len(orig_lines):], len(orig_lines) + 1):
                print(f"L{i:3d} + {line}")
                changed = True
        if not changed:
            print("Nenhuma diferença encontrada.")
        return

    readme_path.write_text(content, encoding="utf-8")
    print("README.md atualizado com sucesso.")


if __name__ == "__main__":
    update_readme(dry_run="--dry-run" in sys.argv)
