import { Schema } from 'mongoose';

/**
 * Makes a schema's JSON output match the `shared` TS interfaces: an `id`
 * string instead of Mongoose's `_id`/`__v`, since the client deserializes
 * API responses directly into those types.
 */
export function applyToJSON(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  });
}
