"""Create or reset the owner account.

    ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' python -m app.create_admin
or run without ADMIN_PASSWORD to be prompted. Passwords need at least 12 characters.
"""
import getpass
import os
import sys

from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.core.security import hash_password
from app.models import AdminUser


def main() -> int:
    email = (os.environ.get("ADMIN_EMAIL") or input("Admin email: ")).strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Password (min 12 chars): ")
    if len(password) < 12:
        print("Password must be at least 12 characters.")
        return 1
    with get_sessionmaker()() as db:
        user = db.scalars(select(AdminUser).where(AdminUser.email == email)).first()
        if user:
            user.password_hash = hash_password(password)
            user.is_active = True
        else:
            db.add(AdminUser(email=email, password_hash=hash_password(password), role="owner"))
        db.commit()
    print(f"Admin account ready: {email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
