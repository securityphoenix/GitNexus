# GitNexus Report Command

Generate comprehensive markdown reports for any GitHub repository without permanently indexing it.

## Overview

The `report` command provides a one-shot analysis of any GitHub repository:

1. **Clone** - Shallow clone the repository to a temporary directory
2. **Analyze** - Run the full GitNexus analysis pipeline
3. **Generate** - Create a detailed markdown report with timestamps
4. **Cleanup** - Delete the cloned repository (keeping only the report)

This is ideal for:
- Quick repository assessments
- Due diligence on external codebases
- Generating documentation for code reviews
- Archiving repository snapshots

## Usage

```bash
# Basic usage (public repo)
gitnexus report owner/repo

# Full GitHub URL
gitnexus report https://github.com/owner/repo

# Private repository with token
gitnexus report owner/private-repo --token ghp_xxxxxxxxxxxx

# Custom output directory
gitnexus report owner/repo --output ./my-reports

# Keep the cloned repo after analysis
gitnexus report owner/repo --keep

# Include code snippets in report
gitnexus report owner/repo --code
```

## Options

| Option | Description |
|--------|-------------|
| `<target>` | GitHub URL or `owner/repo` format (required) |
| `-o, --output <dir>` | Custom output directory for the report |
| `--token <token>` | GitHub PAT for private repos (or set `GITHUB_TOKEN` env var) |
| `--code` | Include code snippets in the report |
| `--keep` | Keep the cloned repository (don't delete after analysis) |

## Report Contents

The generated markdown report includes:

### 1. Overview
- Repository name and URL
- Primary programming language
- Total files, lines, symbols, and relationships
- Number of code communities and execution flows
- License information

### 2. Languages
- Breakdown by language
- File counts and line counts per language
- Percentage distribution
- File extensions used

### 3. Directory Structure
- Visual tree representation
- Top-level directory listing
- File counts per directory

### 4. Main Files
- Key files identified by symbol count
- Entry points marked with 🚀
- Importance ratings (⭐⭐⭐ critical, ⭐⭐ high, ⭐ medium)
- Exported symbols and their types
- Line counts per file

### 5. Dependencies
- Package manager detection
- Runtime dependencies with versions
- Dev dependencies with versions
- Total dependency count

### 6. Docker Configuration
- Dockerfile detection and analysis
- Base images used
- Exposed ports
- Docker Compose services

### 7. Documentation
- README presence and preview
- CONTRIBUTING, CHANGELOG, LICENSE detection
- Additional docs in `/docs` directory

### 8. Code Analysis
- Code communities (clusters) with cohesion scores
- Execution flows with step counts
- Architecture insights

### 9. Metadata
- Repository URL, branch, commit
- Analysis timestamp
- GitNexus version

## Output Location

Reports are saved with timestamped filenames:

```
{owner}-{repo}-{YYYY-MM-DDTHH-MM-SS}.md
```

Default location: `~/.gitnexus/reports/`

## Examples

### Analyze a Public Repository

```bash
$ gitnexus report facebook/react

╔══════════════════════════════════════════════════════════════╗
║           GitNexus Remote Repository Report                  ║
╚══════════════════════════════════════════════════════════════╝

Repository: https://github.com/facebook/react
Output: /Users/you/.gitnexus/reports
Cleanup after: Yes

[████████████████████░] 85% - Analyzing code structure...

╔══════════════════════════════════════════════════════════════╗
║                    Report Generated!                         ║
╚══════════════════════════════════════════════════════════════╝

📄 Report saved to: /Users/you/.gitnexus/reports/facebook-react-2026-02-25T10-30-45.md

Summary:
  • Repository: facebook/react
  • Primary Language: JavaScript
  • Files Analyzed: 2,847
  • Lines of Code: 458,291
  • Symbols Found: 12,456
  • Relationships: 34,892
  • Communities: 45
  • Execution Flows: 128

⏱️  Completed in 45.2s
```

### Analyze a Private Repository

```bash
# Using command-line token
gitnexus report myorg/private-repo --token ghp_xxxxxxxxxxxx

# Using environment variable
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
gitnexus report myorg/private-repo
```

### Batch Analysis Script

```bash
#!/bin/bash
# Analyze multiple repositories

repos=(
  "facebook/react"
  "vuejs/vue"
  "angular/angular"
  "sveltejs/svelte"
)

for repo in "${repos[@]}"; do
  echo "Analyzing $repo..."
  gitnexus report "$repo" --output ./framework-reports
done

echo "All reports generated in ./framework-reports/"
```

## Report Sample

Here's a snippet of what the generated report looks like:

```markdown
# Repository Analysis Report: facebook/react

> Generated by GitNexus v1.2.9 on 2/25/2026, 10:30:45 AM

## Table of Contents

- [Overview](#overview)
- [Languages](#languages)
- [Directory Structure](#directory-structure)
...

## Overview

**Repository:** [facebook/react](https://github.com/facebook/react)

**Description:** A declarative, efficient, and flexible JavaScript library for building user interfaces.

| Metric | Value |
|--------|-------|
| Primary Language | JavaScript |
| Total Files | 2,847 |
| Total Lines | 458,291 |
| Symbols (Functions/Classes) | 12,456 |
| Relationships | 34,892 |
| Code Communities | 45 |
| Execution Flows | 128 |
| License | MIT |
```

## Troubleshooting

### Authentication Failed

```
Error: Authentication failed for repository
```

**Solution:** Ensure your GitHub token has the `repo` scope for private repositories.

### Repository Not Found

```
Error: Repository not found: owner/repo
```

**Solution:** Check the repository URL/name and ensure you have access.

### Analysis Timeout

For very large repositories, the analysis may take several minutes. The progress bar shows current status.

### Disk Space

Temporary files are stored in `~/.gitnexus/temp-reports/` during analysis. Ensure sufficient disk space for the repository clone.

## Integration with CI/CD

You can use the report command in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Generate Repository Report
  run: |
    npm install -g gitnexus
    gitnexus report ${{ github.repository }} --output ./reports
    
- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: repo-analysis
    path: ./reports/*.md
```

## Related Commands

| Command | Description |
|---------|-------------|
| `gitnexus analyze` | Index a local repository (persistent) |
| `gitnexus github scan` | Scan and index GitHub repos |
| `gitnexus wiki` | Generate AI-powered wiki documentation |
