import factory
from factory.django import DjangoModelFactory

from apps.accounts.models import Company, Setor, User


class CompanyFactory(DjangoModelFactory):
    class Meta:
        model = Company

    nome = factory.Sequence(lambda n: f"Company {n}")


class SetorFactory(DjangoModelFactory):
    class Meta:
        model = Setor

    company = factory.SubFactory(CompanyFactory)
    nome = factory.Sequence(lambda n: f"Setor {n}")


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    company = factory.SubFactory(CompanyFactory)
    role = User.Role.RH
    setor = None

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        self.set_password(extracted or "senha12345")
        if create:
            self.save()
