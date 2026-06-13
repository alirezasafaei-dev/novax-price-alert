#!/usr/bin/env python3
"""
Novax Price Alert - Python Deployment using subprocess
Uses system SSH/SCP with password via pexpect (if available) or prompts user
"""

import os
import subprocess
import sys

VPS_IP = os.environ.get("VPS_IP", "193.93.169.58")
VPS_USER = os.environ.get("VPS_USER", "ubuntu")
VPS_PASSWORD = os.environ.get("VPS_PASSWORD", "<set VPS_PASSWORD env var>")
VPS_SSH_KEY_PATH = os.environ.get("VPS_SSH_KEY_PATH", os.path.expanduser("~/.ssh/id_rsa"))
VPS_PORT = 22
APP_DIR = "/home/deploy/novax-price-alert"
DOMAIN = "novax.alirezasafeidev.ir"
LOCAL_DIR = "/home/dev13/my-project/sites/secondary/novax-price-alert"


def print_step(title):
    print(f"\n{'=' * 60}")
    print(f"{title}")
    print("=" * 60)


def get_ssh_key_path():
    """Get SSH key path for deployment."""
    if not os.path.exists(VPS_SSH_KEY_PATH):
        print(f"⚠️  Warning: SSH key not found at {VPS_SSH_KEY_PATH}")
        print("Please set VPS_SSH_KEY_PATH or ensure SSH key exists")
        return None
    return VPS_SSH_KEY_PATH


def run_ssh_command(command, use_key=True):
    """Run SSH command, optionally with SSH key"""
    if use_key:
        key_path = get_ssh_key_path()
        if not key_path:
            print("❌ Cannot run SSH command without SSH key")
            return False

        # Use SSH key authentication
        ssh_cmd = (
            f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
            f"-i {key_path} {VPS_USER}@{VPS_IP} '{command}'"
        )
        result = subprocess.run(ssh_cmd, shell=True, capture_output=True, text=True)
    else:
        ssh_cmd = (
            f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
            f"{VPS_USER}@{VPS_IP} '{command}'"
        )
        result = subprocess.run(ssh_cmd, shell=True, capture_output=True, text=True)

    print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr}")

    return result.returncode == 0


def run_ssh_interactive():
    """Create an SSH connection for manual use"""
    key_path = get_ssh_key_path()
    print_step("SSH to VPS for Manual Deployment")
    if key_path:
        print(f"SSH Key: {key_path}")
    print("\nTo connect manually, run:")
    print(f"ssh -i {VPS_SSH_KEY_PATH} {VPS_USER}@{VPS_IP}")
    print()
    print("Commands to run on VPS:")
    print(f"1. cd {APP_DIR}")
    print("2. python3 -m pip install --upgrade pip")
    print("3. python3 -m pip install -r requirements.txt")
    print("4. cd mini-app && npm install && npm run build && cd ..")
    print("5. alembic upgrade head")
    print("6. Edit .env: set TELEGRAM_RELAY_URL= and TELEGRAM_RELAY_SECRET=")
    print("7. pm2 restart novax-api --update-env")
    print("8. pm2 restart novax-worker --update-env")
    print("9. pm2 restart novax-mini-app --update-env")
    print("10. pm2 save")
    print("11. pm2 status")
    print("12. curl http://127.0.0.1:8001/health")


def sync_files_rsync():
    """Try to sync files using rsync"""
    print_step("Attempting to sync files with rsync")

    # Try using SSH_ASKPASS
    env = os.environ.copy()
    env["SSH_ASKPASS"] = "/bin/echo"
    env["SSH_ASKPASS_REQUIRE"] = "force"
    env["DISPLAY"] = ""

    # This won't work without proper setup, so we'll provide manual instructions
    print("⚠️  Automatic rsync requires SSH key or password setup")
    print("Please sync files manually or run:")
    rsync_cmd = (
        f"rsync -avz --delete --exclude=.git --exclude=__pycache__ "
        f"--exclude=*.pyc --exclude=.venv --exclude=node_modules "
        f"--exclude=.next --exclude=dist --exclude=deploy/cloudflare-worker "
        f". {VPS_USER}@{VPS_IP}:{APP_DIR}/"
    )
    print(rsync_cmd)
    print("\nThen SSH to VPS and continue with manual steps.")

    return False


def main():
    print("🚀 Novax Price Alert - Deployment Assistant")
    print("=" * 60)
    print(f"VPS: {VPS_USER}@{VPS_IP}")
    print(f"Domain: {DOMAIN}")
    print("Bot ID: 8858674032 (@novax_price_bot)")
    print()

    print("Since we cannot use password-based automation in this environment,")
    print("I'll provide you with a complete manual deployment plan.")
    print()

    print_step("Deployment Plan")
    print()
    print("OPTION 1: Manual SSH Deployment (RECOMMENDED)")
    print("-" * 60)
    print("Step 1: Connect to VPS")
    print(f"  ssh {VPS_USER}@{VPS_IP}")
    print(f"  Password: {VPS_PASSWORD}")
    print()
    print("Step 2: Navigate to app directory")
    print(f"  cd {APP_DIR}")
    print()
    print("Step 3: Sync files from your machine (if needed)")
    print("  rsync -avz --delete \\")
    print("    --exclude='.git' \\")
    print("    --exclude='__pycache__' \\")
    print("    --exclude='*.pyc' \\")
    print("    --exclude='.venv' \\")
    print("    --exclude='node_modules' \\")
    print("    --exclude='.next' \\")
    print("    --exclude='dist' \\")
    print("    --exclude='deploy/cloudflare-worker' \\")
    print("    . \\")
    print(f"    {VPS_USER}@{VPS_IP}:{APP_DIR}/")
    print()
    print("Step 4: Install Python dependencies")
    print("  python3 -m pip install --upgrade pip")
    print("  python3 -m pip install -r requirements.txt")
    print()
    print("Step 5: Build mini-app")
    print("  cd mini-app")
    print("  npm install")
    print("  npm run build")
    print("  cd ..")
    print()
    print("Step 6: Run database migrations")
    print("  alembic upgrade head")
    print()
    print("Step 7: Configure for VPS-only mode")
    print("  nano .env  # or your favorite editor")
    print("  Set: TELEGRAM_RELAY_URL=")
    print("  Set: TELEGRAM_RELAY_SECRET=")
    print()
    print("Step 8: Restart PM2 services")
    print("  pm2 restart novax-api --update-env")
    print("  pm2 restart novax-worker --update-env")
    print("  pm2 restart novax-mini-app --update-env")
    print("  pm2 save")
    print()
    print("Step 9: Check PM2 status")
    print("  pm2 status")
    print()
    print("Step 10: Health checks")
    print("  curl http://127.0.0.1:8001/health")
    print("  curl http://127.0.0.1:8001/api/v1/prices/latest")
    print("  curl https://{DOMAIN}/health")
    print()
    print("Step 11: Test bot")
    print("  Open Telegram")
    print("  Find @novax_price_bot")
    print("  Send /start")
    print("  Send /price")
    print("  Try creating an alert")
    print()

    print("=" * 60)
    print("✅ Deployment plan complete!")
    print("=" * 60)
    print()
    print("Quick copy-paste commands:")
    print(f"ssh {VPS_USER}@{VPS_IP}")
    print(f"cd {APP_DIR}")
    print("python3 -m pip install -r requirements.txt")
    print("cd mini-app && npm install && npm run build && cd ..")
    print("alembic upgrade head")
    print("pm2 restart all --update-env")
    print("pm2 status")

    return 0


if __name__ == "__main__":
    sys.exit(main())
