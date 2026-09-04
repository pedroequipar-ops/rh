from uuid import uuid4

from django.db import models

from .managers import ActiveObjects, AllObjects


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True)

    objects = ActiveObjects()
    allobjects = AllObjects()

    class Meta:
        abstract = True

    def soft_delete(self):
        self.active = False
        self.save(update_fields=["active", "updated_at"])
