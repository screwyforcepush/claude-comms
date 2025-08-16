#!/bin/bash

# Tarball Fix Verification Script
# Runs comprehensive tests to verify the GitHub rate limiting fix

set -e

echo "═══════════════════════════════════════════════════════"
echo "   NPX Installer Tarball Fix Verification"
echo "═══════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test directory
TEST_DIR="/tmp/claude-installer-test-$$"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

echo "📁 Test directory: $TEST_DIR"
echo "📦 Package directory: $PACKAGE_DIR"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local test_cmd="$2"
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    if eval "$test_cmd"; then
        echo -e "${GREEN}✅ $test_name passed${NC}\n"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}\n"
        return 1
    fi
}

# Create test directory
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Test 1: Basic Installation
echo "═══════════════════════════════════════════════════════"
echo "Test 1: Basic Installation"
echo "═══════════════════════════════════════════════════════"

START_TIME=$(date +%s)
if npx "$PACKAGE_DIR" --dir "$TEST_DIR/test1"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    if [ $DURATION -lt 30 ]; then
        echo -e "${GREEN}✅ Installation completed in ${DURATION}s (target: <30s)${NC}"
    else
        echo -e "${YELLOW}⚠️ Installation took ${DURATION}s (target: <30s)${NC}"
    fi
    
    # Verify files
    FILE_COUNT=$(find "$TEST_DIR/test1/.claude" -type f 2>/dev/null | wc -l)
    if [ $FILE_COUNT -ge 19 ]; then
        echo -e "${GREEN}✅ Found $FILE_COUNT files (expected: 19+)${NC}"
    else
        echo -e "${RED}❌ Only found $FILE_COUNT files (expected: 19+)${NC}"
    fi
else
    echo -e "${RED}❌ Installation failed${NC}"
fi

echo ""

# Test 2: Dry Run
echo "═══════════════════════════════════════════════════════"
echo "Test 2: Dry Run Mode"
echo "═══════════════════════════════════════════════════════"

if npx "$PACKAGE_DIR" --dry-run --dir "$TEST_DIR/test2" | grep -q "Would install"; then
    echo -e "${GREEN}✅ Dry run completed successfully${NC}"
else
    echo -e "${RED}❌ Dry run failed${NC}"
fi

echo ""

# Test 3: Multiple Rapid Installations (Rate Limit Test)
echo "═══════════════════════════════════════════════════════"
echo "Test 3: Rate Limit Test (3 rapid installations)"
echo "═══════════════════════════════════════════════════════"

TOTAL_TIME=0
for i in 1 2 3; do
    echo "Installation $i..."
    START_TIME=$(date +%s)
    
    if npx "$PACKAGE_DIR" --dir "$TEST_DIR/test3-$i" --force > /dev/null 2>&1; then
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        TOTAL_TIME=$((TOTAL_TIME + DURATION))
        echo "  Completed in ${DURATION}s"
        
        if [ $DURATION -gt 60 ]; then
            echo -e "${RED}⚠️ Installation $i took too long (${DURATION}s)${NC}"
        fi
    else
        echo -e "${RED}❌ Installation $i failed${NC}"
    fi
done

AVG_TIME=$((TOTAL_TIME / 3))
if [ $AVG_TIME -lt 30 ]; then
    echo -e "${GREEN}✅ Average time: ${AVG_TIME}s (no rate limiting detected)${NC}"
else
    echo -e "${RED}❌ Average time: ${AVG_TIME}s (possible rate limiting)${NC}"
fi

echo ""

# Test 4: Verify Python Scripts
echo "═══════════════════════════════════════════════════════"
echo "Test 4: Python Script Permissions"
echo "═══════════════════════════════════════════════════════"

if [ -d "$TEST_DIR/test1/.claude/hooks" ]; then
    PY_FILES=$(find "$TEST_DIR/test1/.claude/hooks" -name "*.py" -type f)
    ALL_EXECUTABLE=true
    
    for file in $PY_FILES; do
        if [ ! -x "$file" ]; then
            echo -e "${RED}❌ Not executable: $file${NC}"
            ALL_EXECUTABLE=false
        fi
    done
    
    if $ALL_EXECUTABLE; then
        echo -e "${GREEN}✅ All Python scripts have correct permissions${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ No hooks directory found to test${NC}"
fi

echo ""

# Test 5: Node.js Verification Tests
echo "═══════════════════════════════════════════════════════"
echo "Test 5: Running Node.js Verification Suite"
echo "═══════════════════════════════════════════════════════"

cd "$PACKAGE_DIR"
if [ -f "test/verification/tarball-fix-tests.js" ]; then
    node test/verification/tarball-fix-tests.js
else
    echo -e "${YELLOW}⚠️ Verification test suite not found${NC}"
fi

echo ""

# Test 6: Check for 575-second wait issue
echo "═══════════════════════════════════════════════════════"
echo "Test 6: Check for 575-second Wait Issue"
echo "═══════════════════════════════════════════════════════"

# Run with timeout to catch long waits
timeout 60 npx "$PACKAGE_DIR" --dir "$TEST_DIR/test6" 2>&1 | tee "$TEST_DIR/test6.log"

if grep -q "575" "$TEST_DIR/test6.log" || grep -q "rate limit" "$TEST_DIR/test6.log"; then
    echo -e "${RED}❌ Detected rate limiting issues${NC}"
    grep -E "(575|rate limit)" "$TEST_DIR/test6.log"
else
    echo -e "${GREEN}✅ No excessive wait times detected${NC}"
fi

echo ""

# Cleanup
echo "═══════════════════════════════════════════════════════"
echo "Cleanup"
echo "═══════════════════════════════════════════════════════"

read -p "Remove test directory $TEST_DIR? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEST_DIR"
    echo "Test directory removed"
else
    echo "Test directory preserved at: $TEST_DIR"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "   Verification Complete"
echo "═══════════════════════════════════════════════════════"