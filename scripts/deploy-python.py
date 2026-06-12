#!/usr/bin/env python3
"""
Novax Price Alert - Python-based Deployment Script
Uses paramiko for SSH connection (no sshpass needed)
"""

import os
import subprocess
import sys

import paramiko

VPS_IP = "<redacted-vps-host>"
VPS_USER = "ubuntu"
VPS_PASSWORD = ""  # Set via environment variable: NOVAX_VPS_PASSWORD
VPS_PORT = 22
APP_DIR = "/home/deploy/novax-price-alert"
DOMAIN = "novax.alirezasafeidev.ir"
LOCAL_DIR = "/home/dev13/my-project/sites/secondary/novax-price-alert"


def print_step(title):
    print(f"\n{'=' * 60}")
    print(f"{title}")
    print("=" * 60)


def get_password():
    """Get VPS password from environment variable."""
    password = os.environ.get("NOVAX_VPS_PASSWORD")
    if not password:
        print("⚠️  Warning: NOVAX_VPS_PASSWORD environment variable not set")
        print("Please set it: export NOVAX_VPS_PASSWORD='your_password'")
        return None
    return password


def run_local_command(cmd):
    """Run a command locally"""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    return True


def ssh_connect():
    """Create SSH connection to VPS"""
    print_step("Connecting to VPS")
    password = get_password()
    if not password:
        print("❌ Cannot connect without password")
        return None

    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(VPS_IP, port=VPS_PORT, username=VPS_USER, password=password, timeout=30)
        print(f"✅ Connected to {VPS_USER}@{VPS_IP}")
        return ssh
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None


def ssh_exec(ssh, command):
    """Execute command on VPS"""
    print(f"SSH: {command}")
    stdin, stdout, stderr = ssh.exec_command(command)
    output = stdout.read().decode()
    error = stderr.read().decode()

    if output:
        print(output)
    if error:
        print(f"Error: {error}")

    exit_status = stdout.channel.recv_exit_status()
    return exit_status == 0


def ssh_exec_with_check(ssh, command, description):
    """Execute command and check result"""
    print(f"\n{description}")
    result = ssh_exec(ssh, command)
    if result:
        print(f"✅ {description} - SUCCESS")
    else:
        print(f"❌ {description} - FAILED")
        return False
    return True


def sync_files_with_sftp(ssh):
    """Sync files using SFTP"""
    print_step("Syncing files to VPS")

    sftp = ssh.open_sftp()

    # Directories to exclude
    exclude_dirs = {
        ".git",
        "__pycache__",
        ".venv",
        "node_modules",
        ".next",
        "dist",
        "deploy/cloudflare-worker",
        ".wrangler",
    }

    files_synced = 0

    for root, dirs, files in os.walk(LOCAL_DIR):
        # Remove excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]

        # Calculate relative path
        rel_path = os.path.relpath(root, LOCAL_DIR)
        if rel_path == ".":
            rel_path = ""

        # Create directories on VPS
        for dir_name in dirs:
            remote_dir_path = os.path.join(APP_DIR, rel_path, dir_name)
            try:
                sftp.mkdir(remote_dir_path)
            except Exception:
                pass  # Directory might exist

        # Upload files
        for file_name in files:
            local_file_path = os.path.join(root, file_name)
            if rel_path:
                remote_file_path = os.path.join(APP_DIR, rel_path, file_name)
            else:
                remote_file_path = os.path.join(APP_DIR, file_name)

            try:
                sftp.put(local_file_path, remote_file_path)
                files_synced += 1
                if files_synced % 10 == 0:
                    print(f"Synced {files_synced} files...")
            except Exception as e:
                print(f"Error syncing {file_name}: {e}")

    sftp.close()
    print(f"✅ Synced {files_synced} files to VPS")
    return True


def main():
    print("🚀 Novax Price Alert - Python Deployment")
    print("=" * 60)
    print(f"VPS: {VPS_USER}@{VPS_IP}")
    print(f"Domain: {DOMAIN}")
    print("Bot ID: 8858674032 (@novax_price_bot)")
    print("")

    # Check if paramiko is installed
    try:
        import importlib.util

        if importlib.util.find_spec("paramiko") is None:
            raise ImportError()
    except ImportError:
        print("❌ paramiko not installed")
        print("Installing...")
        if not run_local_command("pip3 install paramiko"):
            print("❌ Failed to install paramiko")
            return 1

    # Connect to VPS
    ssh = ssh_connect()
    if not ssh:
        return 1

    try:
        # Sync files
        if not sync_files_with_sftp(ssh):
            print("❌ File sync failed")
            return 1

        # Install Python dependencies
        ssh_exec_with_check(
            ssh, f"cd {APP_DIR} && python3 -m pip install --upgrade pip", "Upgrading pip"
        )
        ssh_exec_with_check(
            ssh,
            f"cd {APP_DIR} && python3 -m pip install -r requirements.txt",
            "Installing Python dependencies",
        )

        # Build mini-app
        ssh_exec_with_check(
            ssh, f"cd {APP_DIR}/mini-app && npm install", "Installing Node dependencies"
        )
        ssh_exec_with_check(ssh, f"cd {APP_DIR}/mini-app && npm run build", "Building mini-app")

        # Database migrations
        ssh_exec_with_check(
            ssh, f"cd {APP_DIR} && alembic upgrade head", "Running database migrations"
        )

        # Configure for VPS-only mode
        ssh_exec_with_check(
            ssh,
            f"cd {APP_DIR} && sed -i 's|^TELEGRAM_RELAY_URL=.*|TELEGRAM_RELAY_URL=|' .env",
            "Disabling relay URL",
        )
        ssh_exec_with_check(
            ssh,
            f"cd {APP_DIR} && sed -i 's|^TELEGRAM_RELAY_SECRET=.*|TELEGRAM_RELAY_SECRET=|' .env",
            "Disabling relay secret",
        )

        # Restart PM2 services
        ssh_exec_with_check(
            ssh, f"cd {APP_DIR} && pm2 restart novax-api --update-env", "Restarting novax-api"
        )
        ssh_exec_with_check(
            ssh, f"cd {APP_DIR} && pm2 restart novax-worker --update-env", "Restarting novax-worker"
        )
        ssh_exec_with_check(
            ssh,
            f"cd {APP_DIR} && pm2 restart novax-mini-app --update-env",
            "Restarting novax-mini-app",
        )
        ssh_exec_with_check(ssh, f"cd {APP_DIR} && pm2 save", "Saving PM2 configuration")

        # Health checks
        print_step("Health Checks")
        ssh_exec_with_check(ssh, "curl -s http://127.0.0.1:8001/health", "API Health Check")
        ssh_exec_with_check(
            ssh, "curl -s http://127.0.0.1:8001/api/v1/prices/latest", "Prices API Check"
        )

        # PM2 status
        print_step("PM2 Status")
        ssh_exec(ssh, "pm2 status")

        print_step("Deployment Complete")
        print("✅ Deployment completed successfully!")
        print("\n🌐 Live URLs:")
        print(f"   https://{DOMAIN}")
        print(f"   https://{DOMAIN}/health")
        print(f"   https://{DOMAIN}/api/v1/prices/latest")
        print("\n🤖 Bot: @novax_price_bot (ID: 8858674032)")

        return 0

    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
