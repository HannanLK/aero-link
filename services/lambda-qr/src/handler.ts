import { APIGatewayProxyHandler } from 'aws-lambda';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';

const logger = new Logger({ serviceName: 'lambda-qr' });
const tracer = new Tracer({ serviceName: 'lambda-qr' });

export interface QrRequest {
  type: 'boarding-pass' | 'baggage-barcode';
  payload: string;
}

export interface QrResponse {
  imageBase64: string;
  mimeType: 'image/png';
}

async function generateQR(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    width: 300,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

async function generateBarcode(payload: string): Promise<Buffer> {
  const canvas = createCanvas(400, 150);
  JsBarcode(canvas as unknown as HTMLCanvasElement, payload, {
    format: 'CODE128',
    width: 2,
    height: 100,
    displayValue: true,
    fontSize: 14,
    margin: 10,
    background: '#FFFFFF',
    lineColor: '#000000',
  });
  return canvas.toBuffer('image/png');
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('generate-image');

  try {
    const body = JSON.parse(event.body ?? '{}') as QrRequest;

    if (!body.type || !body.payload) {
      return { statusCode: 400, body: JSON.stringify({ message: 'type and payload are required' }) };
    }

    let imageBuffer: Buffer;
    if (body.type === 'boarding-pass') {
      imageBuffer = await generateQR(body.payload);
    } else if (body.type === 'baggage-barcode') {
      imageBuffer = await generateBarcode(body.payload);
    } else {
      return { statusCode: 400, body: JSON.stringify({ message: 'invalid type' }) };
    }

    const result: QrResponse = {
      imageBase64: imageBuffer.toString('base64'),
      mimeType: 'image/png',
    };

    logger.info('Generated image', { type: body.type, payloadLength: body.payload.length });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    logger.error('Failed to generate image', err as Error);
    subsegment?.addError(err as Error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal error' }) };
  } finally {
    subsegment?.close();
  }
};
