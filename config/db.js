import mongoose from "mongoose"

export const connectDB = async (uri) => {
    try {
        mongoose.connection.on("connected" , () => {
            console.log(`conntected to mongodb succesfully . db name ${mongoose.connection.name} . host ${mongoose.connection.host}`)
        })

        mongoose.connection.on("error" , (error) => {
            console.log(error)
        })

        mongoose.connection.on("disconnected" , () => {
            console.log("mongodb disconnnedted ")
        })

        await mongoose.connect(uri , {
             serverSelectionTimeoutMS : 5000
        })

    } catch (error) {
        console.log(error)
    }
}