#!/bin/bash
# Novax Security Deployment Script
# This script automates the security deployment process

set -e  # Exit on error

# Configuration
VPS_HOST="<redacted-vps-host>"
VPS_USER="ubuntu"
SSH_KEY_PATH="$HOME/.ssh/novax_deploy"
REPO_PATH="$HOME/dev13/my-project/sites/secondary/novax-price-alert"
REMOTE_PATH="/home/ubuntu/novax-price-alert"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${NC}ℹ️  $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check SSH key exists
    if [ ! -f "$SSH_KEY_PATH" ]; then
        print_error "SSH key not found at $SSH_KEY_PATH"
        exit 1
    fi
    print_success "SSH key found"
    
    # Check SSH key permissions
    if [ "$(stat -c %a $SSH_KEY_PATH)" != "600" ]; then
        print_warning "SSH key permissions incorrect, fixing..."
        chmod 600 "$SSH_KEY_PATH"
    fi
    print_success "SSH key permissions correct"
    
    # Check rsync availability
    if ! command -v rsync &> /dev/null; then
        print_error "rsync not installed"
        exit 1
    fi
    print_success "rsync available"
    
    # Check SSH connectivity
    print_info "Testing SSH connectivity..."
    if ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'" &> /dev/null; then
        print_success "SSH connectivity verified"
    else
        print_error "SSH connectivity failed"
        exit 1
    fi
}

# Function to backup current state
backup_current_state() {
    print_info "Creating backup of current state..."
    
    ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" << EOF
cd $REMOTE_PATH
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "Backup created"
else
    echo "No .env file to backup"
fi
EOF
    
    print_success "Backup completed"
}

# Function to sync code to VPS
sync_code() {
    print_info "Syncing code to VPS..."
    
    cd "$REPO_PATH"
    rsync -avz \
        --exclude='.env' \
        --exclude='.venv' \
        --exclude='node_modules' \
        --exclude='__pycache__' \
        --exclude='.pytest_cache' \
        --exclude='*.pyc' \
        --exclude='.git' \
        --exclude='dist' \
        -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no" \
        . "$VPS_USER@$VPS_HOST:$REMOTE_PATH/"
    
    print_success "Code sync completed"
}

# Function to restart services
restart_services() {
    print_info "Restarting services on VPS..."
    
    ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" << EOF
cd $REMOTE_PATH

# Stop services
pm2 stop novax-api novax-worker novax-mini-app

# Update Python dependencies
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

# Update Node dependencies (mini-app)
cd mini-app
npm install
npm run build
cd ..

# Start services
pm2 start novax-api --update-env
pm2 start novax-worker --update-env
pm2 start novax-mini-app --update-env

# Save PM2 configuration
pm2 save
EOF
    
    print_success "Services restarted"
}

# Function to verify deployment
verify_deployment() {
    print_info "Verifying deployment..."
    
    # Check health endpoint
    print_info "Checking health endpoint..."
    if curl -sf https://novax.alirezasafeidev.ir/health > /dev/null; then
        print_success "Health endpoint responding"
    else
        print_error "Health endpoint not responding"
        return 1
    fi
    
    # Check prices API
    print_info "Checking prices API..."
    if curl -sf https://novax.aliresasafeidev.ir/api/v1/prices/latest > /dev/null; then
        print_success "Prices API responding"
    else
        print_error "Prices API not responding"
        return 1
    fi
    
    # Check security headers
    print_info "Checking security headers..."
    HEADERS=$(curl -I https://novax.alirezasafeidev.ir/ 2>&1)
    
    if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
        print_success "X-Content-Type-Options header present"
    else
        print_warning "X-Content-Type-Options header missing"
    fi
    
    if echo "$HEADERS" | grep -q "X-Frame-Options"; then
        print_success "X-Frame-Options header present"
    else
        print_warning "X-Frame-Options header missing"
    fi
    
    if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
        print_success "Strict-Transport-Security header present"
    else
        print_warning "Strict-Transport-Security header missing"
    fi
    
    # Check PM2 status
    print_info "Checking PM2 status..."
    ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "pm2 status"
    
    print_success "Deployment verification completed"
}

# Function to generate security tokens
generate_tokens() {
    print_warning "Token generation is a manual process"
    print_info "Please update .env with new strong tokens:"
    print_info "  - ADMIN_ACCESS_TOKEN (64+ chars)"
    print_info "  - INGEST_API_TOKEN (64+ chars)"
    print_info "  - SECRET_KEY (32+ chars)"
    print_info ""
    print_info "Generate tokens using:"
    print_info "  openssl rand -base64 48"
    print_info "  python3 -c 'import secrets; print(secrets.token_urlsafe(32))'"
}

# Main deployment process
main() {
    print_info "Starting security deployment process..."
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Backup current state
    backup_current_state
    echo ""
    
    # Sync code
    sync_code
    echo ""
    
    # Restart services
    restart_services
    echo ""
    
    # Verify deployment
    verify_deployment
    echo ""
    
    # Token generation reminder
    generate_tokens
    echo ""
    
    print_success "Security deployment completed!"
    print_info "Please review DEPLOY_SECURITY.md for additional steps"
}

# Run main function
main "$@"
