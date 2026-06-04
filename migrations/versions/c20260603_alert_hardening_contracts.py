"""alert hardening contracts

Revision ID: c20260603
Revises: bc1af8ec9ab1
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c20260603"
down_revision: Union[str, Sequence[str], None] = "bc1af8ec9ab1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "alert_rules",
        sa.Column("target_price_display_unit", sa.String(length=16), nullable=False, server_default="IRT"),
    )
    op.add_column(
        "alert_rules",
        sa.Column("display_asset_name_at_creation", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "alert_rules",
        sa.Column(
            "lifecycle_state",
            sa.String(length=32),
            nullable=False,
            server_default="pending_confirmation",
        ),
    )
    op.add_column("alert_rules", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("alert_rules", sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("alert_rules", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("alert_rules", sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        "UPDATE alert_rules SET lifecycle_state = CASE WHEN is_active "
        "THEN 'active' ELSE 'paused' END"
    )
    op.create_index(op.f("ix_alert_rules_lifecycle_state"), "alert_rules", ["lifecycle_state"], unique=False)

    op.add_column("alert_events", sa.Column("event_id", sa.String(length=128), nullable=True))
    op.add_column("alert_events", sa.Column("idempotency_key", sa.String(length=160), nullable=True))
    op.add_column("alert_events", sa.Column("worker_run_id", sa.String(length=64), nullable=True))
    op.add_column("alert_events", sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "alert_events", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "alert_events", sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3")
    )
    op.add_column("alert_events", sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        "UPDATE alert_events SET event_id = 'alert:' || alert_rule_id || ':observed:' || triggered_at "
        "WHERE event_id IS NULL"
    )
    op.execute(
        "UPDATE alert_events SET idempotency_key = 'notification:' || event_id "
        "WHERE idempotency_key IS NULL"
    )
    with op.batch_alter_table("alert_events") as batch_op:
        batch_op.alter_column(
            "event_id",
            existing_type=sa.String(length=128),
            nullable=False,
        )
        batch_op.alter_column(
            "idempotency_key",
            existing_type=sa.String(length=160),
            nullable=False,
        )
        batch_op.create_unique_constraint("uq_alert_events_event_id", ["event_id"])
        batch_op.create_unique_constraint(
            "uq_alert_events_idempotency_key", ["idempotency_key"]
        )


def downgrade() -> None:
    op.drop_constraint("uq_alert_events_idempotency_key", "alert_events", type_="unique")
    op.drop_constraint("uq_alert_events_event_id", "alert_events", type_="unique")
    op.drop_column("alert_events", "next_retry_at")
    op.drop_column("alert_events", "max_attempts")
    op.drop_column("alert_events", "attempt_count")
    op.drop_column("alert_events", "claimed_at")
    op.drop_column("alert_events", "worker_run_id")
    op.drop_column("alert_events", "idempotency_key")
    op.drop_column("alert_events", "event_id")

    op.drop_index(op.f("ix_alert_rules_lifecycle_state"), table_name="alert_rules")
    op.drop_column("alert_rules", "cancelled_at")
    op.drop_column("alert_rules", "delivered_at")
    op.drop_column("alert_rules", "triggered_at")
    op.drop_column("alert_rules", "confirmed_at")
    op.drop_column("alert_rules", "lifecycle_state")
    op.drop_column("alert_rules", "display_asset_name_at_creation")
    op.drop_column("alert_rules", "target_price_display_unit")
