import { z } from "zod";

export const BoundaryRectSchema = z.object({
    leftDistance: z.number(),
    topDistance: z.number(),
    rightDistance: z.number(),
    bottomDistance: z.number(),
    width: z.number(),
    height: z.number(),
})

export const WidgetableBaseWidgetSchemaPart = {
    name: z.string(),
    uiWeight: z.number(),
}
export const WidgetableImagesWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('images'),
    options: z.object({
        required: z.boolean(),
        maxCount: z.number().optional(),
        maskMode: z.boolean().optional()
    })
})
export const WidgetableMasksWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('masks'),
    options: z.object({
        required: z.boolean()
    })
})
export const WidgetableStringWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('string'),
    options: z.object({
        required: z.boolean()
    })
})
export const WidgetableToggleWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('boolean'),
    options: z.object({
        required: z.boolean()
    })
})
export const WidgetableNumberWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('number'),
    options: z.object({
        required: z.boolean(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().optional(),
        random: z.boolean().optional(),
        slider: z.boolean().optional()
    })
})
export const WidgetableComboWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('combo'),
    options: z.object({
        required: z.boolean(),
        values: z.array(z.string()),
        labels: z.array(z.string()).optional()
    })
})
export const WidgetableSegmentWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('segment'),
    options: z.object({
        required: z.boolean(),
        values: z.array(z.string())
    })
})
export const WidgetableVideoWidgetSchema = z.object({
    ...WidgetableBaseWidgetSchemaPart,
    outputType: z.literal('video'),
    options: z.object({
        required: z.boolean(),
    })
})
export const WidgetableWidgetSchema = z.discriminatedUnion("outputType", [
    WidgetableImagesWidgetSchema,
    WidgetableMasksWidgetSchema,
    WidgetableStringWidgetSchema,
    WidgetableToggleWidgetSchema,
    WidgetableNumberWidgetSchema,
    WidgetableComboWidgetSchema,
    WidgetableSegmentWidgetSchema,
    WidgetableVideoWidgetSchema,
])
export const WidgetableNodeSchema = z.object({
    id: z.string(),
    title: z.string(),
    widgets: z.array(WidgetableWidgetSchema),
    uiWeightSum: z.number()
})
export const WidgetableStructureSchema = z.object({
    widgetableID: z.string(),
    widgetablePath: z.string(),
    nodes: z.record(z.string(), WidgetableNodeSchema),
    nodeIndexes: z.array(z.string()),
    note: z.string().optional(),
    options: z.record(z.string(), z.any())
})

export type WidgetableImagesWidget = z.infer<typeof WidgetableImagesWidgetSchema>;
export type WidgetableMasksWidget = z.infer<typeof WidgetableMasksWidgetSchema>;
export type WidgetableStringWidget = z.infer<typeof WidgetableStringWidgetSchema>;
export type WidgetableToggleWidget = z.infer<typeof WidgetableToggleWidgetSchema>;
export type WidgetableNumberWidget = z.infer<typeof WidgetableNumberWidgetSchema>;
export type WidgetableComboWidget = z.infer<typeof WidgetableComboWidgetSchema>;
export type WidgetableSegmentWidget = z.infer<typeof WidgetableSegmentWidgetSchema>;
export type WidgetableWidget = z.infer<typeof WidgetableWidgetSchema>;
export type WidgetableNode = z.infer<typeof WidgetableNodeSchema>;
export type WidgetableStructure = z.infer<typeof WidgetableStructureSchema>;
export type WidgetableValues = Record<string, any[]>

export function getDefaultValues(otuputType: string, options: any) {
    switch (otuputType) {
        case 'images':
            return [];
        case 'masks':
            return [];
        case 'string':
            return '';
        case 'boolean':
            return false;
        case 'number':
            return 0;
        case 'combo':
            return options.values[0];
    }
}
