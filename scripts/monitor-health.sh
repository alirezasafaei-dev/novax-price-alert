#!/bin/bash

# Novax Price Alert Health Monitoring Script
# Checks system health and provides status report

# Configuration
BASE_URL="${NOVAX_BASE_URL:-https://novax.alirezasafeidev.ir}"
HEALTH_ENDPOINT="$BASE_URL/health"
API_ENDPOINT="$BASE_URL/api/v1/prices/latest"
ADMIN_TOKEN="${NOVAX_ADMIN_TOKEN:-}"

echo "🔍 Novax Price Alert Health Monitoring"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}

    echo "📡 Checking $name..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)

    if [ "$response" -eq "$expected_code" ]; then
        echo -e "${GREEN}✅ $name: HTTP $response${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: HTTP $response (expected $expected_code)${NC}"
        return 1
    fi
}

# Function to check API response
check_api_response() {
    local url=$1
    local name=$2

    echo "📊 Checking $name response..."
    response=$(curl -s "$url" --max-time 10)

    if echo "$response" | grep -q "prices\|latest\|status"; then
        echo -e "${GREEN}✅ $name: Valid response${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: Invalid response${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Function to check response time
check_response_time() {
    local url=$1
    local name=$2
    local max_time=${3:-2}

    echo "⏱️  Checking $name response time..."
    start_time=$(date +%s%3N)
    curl -s "$url" --max-time 10 > /dev/null
    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))

    if [ "$response_time" -lt $((max_time * 1000)) ]; then
        echo -e "${GREEN}✅ $name: ${response_time}ms (under ${max_time}s)${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $name: ${response_time}ms (over ${max_time}s)${NC}"
        return 1
    fi
}

# Main checks
total_checks=0
passed_checks=0

echo "🚀 System Health Checks"
echo "---------------------"

# 1. Health endpoint
((total_checks++))
if check_endpoint "$HEALTH_ENDPOINT" "Health Endpoint"; then
    ((passed_checks++))
fi
echo ""

# 2. Response time
((total_checks++))
if check_response_time "$HEALTH_ENDPOINT" "Health Response Time" 2; then
    ((passed_checks++))
fi
echo ""

# 3. API endpoint
((total_checks++))
if check_endpoint "$API_ENDPOINT" "API Endpoint"; then
    ((passed_checks++))
fi
echo ""

# 4. API response validation
((total_checks++))
if check_api_response "$API_ENDPOINT" "API Response"; then
    ((passed_checks++))
fi
echo ""

# 5. API response time
((total_checks++))
if check_response_time "$API_ENDPOINT" "API Response Time" 1; then
    ((passed_checks++))
fi
echo ""

# 6. Admin panel (if token provided)
if [ -n "$ADMIN_TOKEN" ]; then
    ((total_checks++))
    echo "🔐 Checking Admin Panel..."
    admin_url="$BASE_URL/admin?token=$ADMIN_TOKEN"
    if check_endpoint "$admin_url" "Admin Panel"; then
        ((passed_checks++))
    fi
    echo ""
fi

# Summary
echo "======================================="
echo "📊 Health Check Summary"
echo "-----------------------"

if [ $passed_checks -eq $total_checks ]; then
    echo -e "${GREEN}✅ All health checks passed!${NC}"
    echo "   Total: $total_checks / $passed_checks passed"
    exit 0
else
    echo -e "${RED}❌ Some health checks failed${NC}"
    echo "   Total: $total_checks / $passed_checks passed"
    echo "   Failed: $((total_checks - passed_checks))"
    exit 1
fi