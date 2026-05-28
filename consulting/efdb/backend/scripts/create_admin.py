"""Create or promote an admin user.

Usage (inside the backend container):
    python -m scripts.create_admin <email> <full_name> <password>

If the email already exists, the user is promoted to admin and the password is reset.
Run via: fly ssh console -C "python -m scripts.create_admin alice@x.com 'Alice' s3cret"
"""
import asyncio
import sys
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.routers.auth import hash_password


async def main(email: str, full_name: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            existing.role = UserRole.admin
            existing.hashed_password = hash_password(password)
            existing.is_active = True
            await db.commit()
            print(f"Promoted existing user {email} to admin and reset password.")
            return
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role=UserRole.admin,
        )
        db.add(user)
        await db.commit()
        print(f"Created admin user {email}.")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python -m scripts.create_admin <email> <full_name> <password>", file=sys.stderr)
        sys.exit(2)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
