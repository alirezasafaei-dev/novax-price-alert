#!/usr/bin/env python3
"""
Novax Price Alert - Python Deployment using subprocess
Uses system SSH/SCP with password via pexpect (if available) or prompts user
"""

import os
import subprocess
import sys

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


def run_ssh_command(command, use_password=True):
    """Run SSH command, optionally with password"""
    if use_password:
        password = get_password()
        if not password:
            print("❌ Cannot run SSH command without password")
            return False

        # Create a temporary script with password embedded
        ssh_cmd = (
            f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
            f"{VPS_USER}@{VPS_IP} '{command}'"
        )
        script = f"""#!/bin/bash
echo "{password}" | {ssh_cmd}
"""
        result = subprocess.run(script, shell=True, capture_output=True, text=True)
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
    password = get_password()
    print_step("SSH to VPS for Manual Deployment")
    if password:
        print(f"Password: {password}")
    print("\nTo connect manually, run:")
    print(f"ssh {VPS_USER}@{VPS_IP}")
    if password:
        print(f"Then use password: {password}")
    else:
        print("Then use password from environment variable: NOVAX_VPS_PASSWORD")
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
