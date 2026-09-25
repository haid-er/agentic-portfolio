/**
 * A tiny CNN-LSTM, trained in the browser with TensorFlow.js on synthetic windows.
 * Conv1D blocks learn local motion shapes (steps, impacts); the LSTM reads their order in time.
 * tfjs is imported dynamically so it never lands in a shared chunk.
 */
import type * as TF from '@tensorflow/tfjs'
import { ACTIVITIES, CH, WIN } from './signal'

const K = ACTIVITIES.length
let tfPromise: Promise<typeof TF> | null = null

export function loadTf(): Promise<typeof TF> {
  tfPromise ??= import('@tensorflow/tfjs').then(async (tf) => {
    await tf.ready()
    return tf
  }).catch((e: unknown) => {
    tfPromise = null
    throw e
  })
  return tfPromise
}

export interface EpochLog { epoch: number; loss: number; acc: number; valLoss: number; valAcc: number }

export interface CnnLstm {
  predict(ch: Float32Array): number[]
  backend: string
  params: number
  valAcc: number
  dispose(): void
}

export const LAYERS_SUMMARY = ['Conv1D 12 × k5', 'MaxPool 4', 'Conv1D 16 × k3', 'MaxPool 2', 'LSTM 16', 'Dropout .2', `Dense ${K} softmax`]

export async function trainCnnLstm(
  data: { x: Float32Array[]; y: number[] },
  opts: { epochs: number; onEpoch: (log: EpochLog) => void; signal: AbortSignal },
): Promise<CnnLstm> {
  const tf = await loadTf()
  if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const N = data.x.length
  const flat = new Float32Array(N * WIN * CH)
  data.x.forEach((x, i) => flat.set(x.subarray(0, WIN * CH), i * WIN * CH))

  const model = tf.sequential()
  model.add(tf.layers.conv1d({ inputShape: [WIN, CH], filters: 12, kernelSize: 5, padding: 'same', activation: 'relu' }))
  model.add(tf.layers.maxPooling1d({ poolSize: 4 }))
  model.add(tf.layers.conv1d({ filters: 16, kernelSize: 3, padding: 'same', activation: 'relu' }))
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }))
  model.add(tf.layers.lstm({ units: 16, recurrentInitializer: 'glorotUniform' }))
  model.add(tf.layers.dropout({ rate: 0.2 }))
  model.add(tf.layers.dense({ units: K, activation: 'softmax' }))
  model.compile({ optimizer: tf.train.adam(0.008), loss: 'categoricalCrossentropy', metrics: ['accuracy'] })

  const xs = tf.tensor3d(flat, [N, WIN, CH])
  const labels = tf.tensor1d(data.y, 'int32')
  const ys = tf.oneHot(labels, K)
  let valAcc = 0
  try {
    await model.fit(xs, ys, {
      epochs: opts.epochs,
      batchSize: 32,
      shuffle: true,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const l = logs ?? {}
          valAcc = Number(l.val_acc ?? l.val_accuracy ?? 0)
          opts.onEpoch({
            epoch: epoch + 1,
            loss: Number(l.loss ?? 0),
            acc: Number(l.acc ?? l.accuracy ?? 0),
            valLoss: Number(l.val_loss ?? 0),
            valAcc,
          })
          if (opts.signal.aborted) model.stopTraining = true
          await tf.nextFrame()
        },
      },
    })
  } catch (e) {
    model.dispose()
    throw e
  } finally {
    xs.dispose(); labels.dispose(); ys.dispose()
  }
  if (opts.signal.aborted) {
    model.dispose()
    throw new DOMException('Aborted', 'AbortError')
  }

  return {
    backend: tf.getBackend(),
    params: model.countParams(),
    valAcc,
    predict(ch) {
      return tf.tidy(() => {
        const out = model.predict(tf.tensor3d(ch.subarray(0, WIN * CH), [1, WIN, CH])) as TF.Tensor
        return Array.from(out.dataSync())
      })
    },
    dispose: () => model.dispose(),
  }
}
