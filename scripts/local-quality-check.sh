#!/bin/bash

# Novax Price Alert Local Quality Check Script
# Performs local quality checks without requiring external access

echo "🔍 Novax Price Alert Local Quality Check"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Change to project directory
cd /home/dev13/my-project/sites/secondary/novax-price-alert || exit 1

total_checks=0
passed_checks=0

# Function to run check
run_check() {
    local command=$1
    local name=$2

    echo "🔧 Running: $name"
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name: PASSED${NC}"
        ((passed_checks++))
    else
        echo -e "${RED}❌ $name: FAILED${NC}"
    fi
    ((total_checks++))
    echo ""
}

echo "📊 Git Status Check"
echo "-------------------"
((total_checks++))
if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✅ Git: Working directory clean${NC}"
    ((passed_checks++))
else
    echo -e "${YELLOW}⚠️  Git: Uncommitted changes${NC}"
    git status --short
fi
echo ""

echo "🧪 Test Suite Check"
echo "-------------------"
# Check if we can run tests
if command -v python3 &> /dev/null; then
    run_check "python3 -m pytest tests/ -v --tb=short" "Pytest Tests"
else
    echo -e "${YELLOW}⚠️  Python3 not available for testing${NC}"
    ((total_checks++))
fi

echo ""

echo "🔍 Code Quality Check"
echo "-------------------"
if command -v ruff &> /dev/null; then
    run_check "ruff check ." "Ruff Linting"
else
    echo -e "${YELLOW}⚠️  Ruff not available for linting${NC}"
    ((total_checks++))
fi

echo ""

echo "📝 Documentation Check"
echo "---------------------"
docs_to_check=(
    "README.md"
    "docs/PROGRESS.md"
    "docs/CODE_REALITY_REPORT.md"
    "AGENTS.md"
    "docs/USER_GUIDE_FA.md"
    "docs/ARCHITECTURE.md"
)

for doc in "${docs_to_check[@]}"; do
    ((total_checks++))
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✅ Documentation: $doc exists${NC}"
        ((passed_checks++))
    else
        echo -e "${RED}❌ Documentation: $doc missing${NC}"
    fi
done

echo ""

echo "🏗️  Project Structure Check"
echo "-------------------------"
key_dirs=(
    "src/novax_price_alert"
    "tests"
    "migrations"
    "docs"
    "scripts"
)

for dir in "${key_dirs[@]}"; do
    ((total_checks++))
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ Directory: $dir exists${NC}"
        ((passed_checks++))
    else
        echo -e "${RED}❌ Directory: $dir missing${NC}"
    fi
done

echo ""

echo "📋 Key Files Check"
echo "-----------------"
key_files=(
    "src/novax_price_alert/__init__.py"
    "src/novax_price_alert/main.py"
    "pyproject.toml"
    ".env.example"
)

for file in "${key_files[@]}"; do
    ((total_checks++))
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ File: $file exists${NC}"
        ((passed_checks++))
    else
        echo -e "${RED}❌ File: $file missing${NC}"
    fi
done

echo ""

echo "🔐 Security Check"
echo "----------------"
((total_checks++))
if [ ! -f ".env" ] || [ -f ".env" ] && ! grep -q "SECRET\|TOKEN\|KEY" ".env" 2>/dev/null; then
    echo -e "${GREEN}✅ Security: No exposed secrets in .env${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ Security: Potential secrets in .env${NC}"
fi

echo ""

echo "=========================================="
echo "📊 Quality Check Summary"
echo "-----------------------"

if [ $passed_checks -eq $total_checks ]; then
    echo -e "${GREEN}✅ All quality checks passed!${NC}"
    echo "   Total: $total_checks / $passed_checks passed"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some quality checks failed${NC}"
    echo "   Total: $total_checks / $passed_checks passed"
    echo "   Failed: $((total_checks - passed_checks))"
    exit 1
fi