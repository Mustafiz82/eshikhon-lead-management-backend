import mongoose from "mongoose";

const { Schema, model } = mongoose;


const DiscountSchema = new Schema(
    {

        name: { type: String, required: true, trim: true, },
        authority: { type: String, enum: ["agent", "management", "committed"], required: true, index: true, },
        mode: { type: String, enum: ["percent", "amount"], required: true, },
        value: { type: Number, default: null, },
        minValue: { type: Number, default: null },
        maxValue: { type: Number, default: null, },
        capAmount: { type: Number, default: null, },
        startAt: { type: Date, required: true, },
        expireAt: { type: Date, required: true, index: true, },

        appliesTo: [
            { type: Schema.Types.ObjectId, ref: "Course", index: true }
        ],


        notes: { type: String, trim: true },
    },
    { timestamps: true }
);


/* ---------- Validation rules ---------- */
DiscountSchema.pre("validate", function (next) {
    const d = this;

    // time window sanity
    if (d.startAt && d.expireAt && d.startAt >= d.expireAt) {
        return next(new Error("startAt must be before expireAt")); // fixed message
    }

    // helper
    const isFiniteNum = (v) => v == null || (typeof v === "number" && Number.isFinite(v));

    // quick finite checks for all numeric fields
    for (const [key, val] of Object.entries({
        value: d.value, minValue: d.minValue, maxValue: d.maxValue, capAmount: d.capAmount,
    })) {
        if (!isFiniteNum(val)) return next(new Error(`${key} must be a finite number`));
    }

    if (d.mode === "percent") {
        if (d.value != null && (d.value <= 0 || d.value > 100)) {
            return next(new Error("Percent value must be between 0 and 100"));
        }
        if (d.minValue != null && (d.minValue <= 0 || d.minValue > 100)) {
            return next(new Error("Percent minValue must be between 0 and 100"));
        }
        if (d.maxValue != null && (d.maxValue <= 0 || d.maxValue > 100)) {
            return next(new Error("Percent maxValue must be between 0 and 100"));
        }
        if (d.minValue != null && d.maxValue != null && d.minValue > d.maxValue) {
            return next(new Error("minValue cannot be greater than maxValue"));
        }
        // new: capAmount must be > 0 if provided
        if (d.capAmount != null && d.capAmount <= 0) {
            return next(new Error("capAmount must be greater than 0"));
        }
    } else {
        // amount mode: values must be > 0 (if present)
        const pos = (v, label) => (v != null && v <= 0 ? `${label} must be greater than 0` : null);
        const err = pos(d.value, "value") || pos(d.minValue, "minValue") || pos(d.maxValue, "maxValue");
        if (err) return next(new Error(err));
        if (d.minValue != null && d.maxValue != null && d.minValue > d.maxValue) {
            return next(new Error("minValue cannot be greater than maxValue"));
        }
    }

    if (d.authority === "committed") {
        
        if (d.value == null) {
            return next(new Error("Committed discounts require a fixed 'value'"));
        }
        if (d.minValue != null || d.maxValue != null) {
            return next(new Error("Committed discounts cannot have minValue/maxValue"));
        }
    } else {
        if (d.minValue == null || d.maxValue == null) {
            return next(new Error("Flexible discounts require minValue and maxValue"));
        }
    }

    next();
});

DiscountSchema.index({ name: 1, authority: 1, startAt: 1, expireAt: 1 });

export default model("Discount", DiscountSchema);
