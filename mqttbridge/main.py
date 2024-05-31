import os, sys
import logging
DEBUG = os.environ.get('DEBUG')
logging.basicConfig(stream=sys.stdout,
    format='[%(asctime)s] %(levelname)s %(module)s/%(funcName)s - %(message)s',
    level=logging.DEBUG if DEBUG else logging.INFO)

import time
import json

import asyncio
import aiohttp
from aiomqtt import Client, TLSParameters

tls_params = TLSParameters(
    ca_certs='/etc/ssl/certs/ISRG_Root_X1.pem',
)

import secrets

async def process_solar_aps(topic, text):
    topic_parts = topic.split('/')

    if topic_parts[2] != 'power':
        logging.debug('Invalid aps topic, returning')
        return

    ecu_id = topic_parts[1]
    power = text
    solar_user = secrets.SOLAR_USERS[ecu_id]

    logging.info('ECU ID: %s, user: %s, power: %s', ecu_id, solar_user, power)

    async with aiohttp.ClientSession() as session:
        data = dict(user=solar_user, power=power)

        try:
            if DEBUG:
                url = 'https://api.spaceport.dns.t0.vc/stats/solar_data/'
            else:
                url = 'https://api.my.protospace.ca/stats/solar_data/'

            await session.post(url, json=data, timeout=10)

            logging.info('Sent to portal URL: %s', url)
        except BaseException as e:
            logging.error('Problem sending json to portal %s:', url)
            logging.exception(e)


async def process_mqtt(message):
    text = message.payload.decode()
    topic = message.topic.value
    logging.debug('MQTT topic: %s, message: %s', topic, text)

    if topic.startswith('aps/'):
        await process_solar_aps(topic, text)
    else:
        logging.debug('Invalid topic, returning')
        return

async def fetch_mqtt():
    await asyncio.sleep(3)

    async with Client(
        hostname='webhost.protospace.ca',
        port=8883,
        username='reader',
        password=secrets.MQTT_READER_PASSWORD,
        tls_params=tls_params,
    ) as client:
        await client.subscribe('#')
        async for message in client.messages:
            loop = asyncio.get_event_loop()
            loop.create_task(process_mqtt(message))


if __name__ == '__main__':
    logging.info('')
    logging.info('==========================')
    logging.info('Booting up...')

    loop = asyncio.get_event_loop()
    loop.run_until_complete(fetch_mqtt())
