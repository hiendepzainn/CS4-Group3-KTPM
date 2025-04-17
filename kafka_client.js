const { Kafka } = require('kafkajs');

// Tạo message broker
const kafka = new Kafka({
  clientId: 'express-kafka-app',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'express-group' });

module.exports = { kafka, producer, consumer };
