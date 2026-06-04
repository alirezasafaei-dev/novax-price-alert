"""add asset canonical id

Revision ID: d20260604
Revises: c20260603
Create Date: 2026-06-04 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d20260604"
down_revision: Union[str, Sequence[str], None] = "c20260603"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "assets",
        sa.Column("canonical_id", sa.String(length=50), nullable=True),
    )
    op.execute("UPDATE assets SET canonical_id = symbol WHERE canonical_id IS NULL")
    with op.batch_alter_table("assets") as batch_op:
        batch_op.alter_column("canonical_id", nullable=False)
        batch_op.create_unique_constraint("uq_assets_canonical_id", ["canonical_id"])

    op.add_column(
        "alert_rules",
        sa.Column("canonical_asset_id", sa.String(length=50), nullable=True),
    )
    op.execute(
        "UPDATE alert_rules SET canonical_asset_id = "
        "(SELECT canonical_id FROM assets WHERE assets.id = alert_rules.asset_id)"
    )
    with op.batch_alter_table("alert_rules") as batch_op:
        batch_op.alter_column("canonical_asset_id", nullable=False)
    op.create_index(
        op.f("ix_alert_rules_canonical_asset_id"),
        "alert_rules",
        ["canonical_asset_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_alert_rules_canonical_asset_id"), table_name="alert_rules")
    op.drop_column("alert_rules", "canonical_asset_id")
    op.drop_constraint("uq_assets_canonical_id", "assets", type_="unique")
    op.drop_column("assets", "canonical_id")
