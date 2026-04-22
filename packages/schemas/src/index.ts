import { z } from "zod";

export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retry_after_s: z.number().int().nonnegative().optional(),
    upstream_status: z.number().int().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export const RucParam = z
  .string()
  .regex(/^\d{11}$/, "RUC must be exactly 11 digits");

export const RucResponse = z.object({
  ruc: z.string(),
  razon_social: z.string(),
  estado: z.enum(["ACTIVO", "BAJA DE OFICIO", "SUSPENSION TEMPORAL", "INACTIVO"]).or(z.string()),
  condicion: z.string(),
  domicilio: z.string().nullable(),
  actividad_economica: z.string().nullable(),
  fecha_inscripcion: z.string().nullable(),
  fetched_at: z.string().datetime(),
  stale: z.boolean().default(false),
});
export type RucResponse = z.infer<typeof RucResponse>;

export const FxRatesQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

export const FxRatesResponse = z.object({
  date: z.string(),
  rates: z.array(
    z.object({
      pair: z.enum(["USD/PEN", "EUR/PEN"]),
      buy: z.number(),
      sell: z.number(),
    }),
  ),
  fetched_at: z.string().datetime(),
  stale: z.boolean().default(false),
});
export type FxRatesResponse = z.infer<typeof FxRatesResponse>;

export const FxIndicatorType = z.enum(["tea", "tipmn", "tamn"]);

export const FxIndicatorsQuery = z.object({
  type: FxIndicatorType,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const FxIndicatorsResponse = z.object({
  type: FxIndicatorType,
  date: z.string(),
  value: z.number(),
  unit: z.string(),
  fetched_at: z.string().datetime(),
  stale: z.boolean().default(false),
});
export type FxIndicatorsResponse = z.infer<typeof FxIndicatorsResponse>;

export const TenderSearchQuery = z.object({
  query: z.string().min(1).optional(),
  region: z.string().optional(),
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const Tender = z.object({
  id: z.string(),
  title: z.string(),
  entity: z.string(),
  region: z.string().nullable(),
  published_at: z.string().datetime(),
  deadline: z.string().datetime().nullable(),
  amount_pen: z.number().nullable(),
  url: z.string().url(),
});
export type Tender = z.infer<typeof Tender>;

export const TenderSearchResponse = z.object({
  results: z.array(Tender),
  fetched_at: z.string().datetime(),
  stale: z.boolean().default(false),
});
export type TenderSearchResponse = z.infer<typeof TenderSearchResponse>;
