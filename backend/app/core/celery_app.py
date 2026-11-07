from celery import Celery
from kombu import Exchange, Queue

from app.core.config import settings

celery_app = Celery(
    "notify_hub_worker",
    broker=settings.RABBITMQ_URL,
)

# We want to use a topic exchange "notify.events"
task_exchange = Exchange('notify.events', type='topic')

celery_app.conf.task_queues = (
    Queue('q.events.high', task_exchange, routing_key='*.high'),
    Queue('q.events.default', task_exchange, routing_key='*.default'),
    Queue('q.events.low', task_exchange, routing_key='*.low'),
)

celery_app.conf.task_default_queue = 'q.events.default'
celery_app.conf.task_default_exchange = 'notify.events'
celery_app.conf.task_default_routing_key = 'default.default'

# Important for reliability
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1
