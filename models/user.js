import mongoose from "mongoose";
import { genSalt, hash } from "bcrypt"
const userSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, required: true },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            unique: true,
            required: true
        },

        password: { type: String, minlength: 6, select: false, required: true },

        role: { type: String, enum: ["user", "admin"], default: "user" },

        designation: {
            type: String,
            enum: ["Junior Executive", "Executive", "Senior Executive" , null],
          
        },

        target: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);


userSchema.pre("save", async function () {
    const salt = await genSalt(10)
    this.password = await hash(this.password, salt)
})


userSchema.pre("findOneAndUpdate", async function () {
    const update = this.getUpdate()
    const password = update.password

    if (!password) {
        return  // No password change → skip hashing
    }
    const salt = await genSalt(10)
    const hashed = await hash(password , salt)
    update.password = hashed

    
    // const salt = await genSalt(10)
    // this.password = await hash( this.password , salt)

})

export default mongoose.model("User", userSchema);

