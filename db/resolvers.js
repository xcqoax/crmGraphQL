const Usuario = require('../models/Usuarios')
const Producto = require('../models/Productos')
const Cliente = require('../models/Cliente')
const Pedido = require('../models/Pedido')

const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config({path:'variables.env'})


const crearToken = (usuario, secreta, expiresIn) =>{
    //console.log(usuario);
    const { id, email, nombre, apellido} = usuario

    return jwt.sign({id, email, nombre, apellido}, secreta, { expiresIn })
}

//resolver

const resolvers = {
    Query:{
        obtenerUsuario: async(_, {}, ctx)=> {
            

            return ctx.usuario;
        },
        obtenerProductos: async()=>{
            try{
                const productos = await Producto.find({})
                return productos
            }catch(error){
                console.log(error)
            }
        },
        obtenerProducto:async(_,{id})=>{
            //revisar si el producto existe
            const producto = await Producto.findById(id)
            if(!producto){
                throw new Error('Producto no encontrado')
            }

            return producto
        },
        obtenerClientes:async()=>{
            try{
                const clientes = await Cliente.find({})
                return clientes
            }catch(error){
                //console.log(error)
            }
        },
        obtenerClientesVendedor:async(_,{},ctx)=>{
            try{
                const clientes = await Cliente.find({vendedor: ctx.usuario.id.toString()})
                return clientes
            }catch(error){
                //console.log(error)
            }
            
        },
        obtenerCliente:async(_,{id},ctx)=>{
            //existe el cliente o no
            const cliente = await Cliente.findById(id)
            if(!cliente){
                throw new Error('Cliente no encontrado')
            }
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales para')
            }

            return cliente
        },
        obtenerPedidos:async()=>{
            try{
                const pedidos = await Pedido.find({})
                return pedidos
            }catch(error){
                console.log(error)
            }
        },
        obtenerPedidoVendedor: async(_,{},ctx)=>{
            try{
                const pedidos = await Pedido.find({vendedor: ctx.usuario.id}).populate('cliente')
                
                console.log(pedidos)
                return pedidos
            }catch(error){
                console.log(error)
            }
        },
        obtenerPedido:async(_,{id})=>{
            const pedido = await Pedido.findById(id)
            if(!pedido){
                throw new Error('el pedido no existe')
            }

            if(pedido.vendedor.toString()!== ctx.usuario.id){
                throw new Error('No tienes las credenciales para ver el pedido')
            }
            return pedido
        },
        obtenerPedidoEstado:async(_,{estado},ctx)=>{
            const pedidoEstado = await Pedido.findById({vendedor:ctx.usuario.id, estado})

            return pedidoEstado
        },
        mejoresClientes: async()=>{
            const clientes =  await Pedido.aggregate([
                { $match : {estado : "COMPLETADO"}},
                { $group : {
                    _id: "$cliente",
                    total: { $sum: '$total'}
                }},
                {
                $lookup: {
                    from: 'clientes',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'cliente'
                }
                },
                {
                    $sort: { total : -1}
                }
            ])
            return clientes
        },
        mejoresVendedores: async()=>{
           const vendedores = await Pedido.aggregate([
               {$match: {estado: "COMPLETADO"}},
               {$group:{
                   _id:"$vendedor",
                   total: { $sum: '$total'}
               }},
               {
                $lookup: {
                    from: 'usuarios',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'vendedor'
                }
               },
               {
                   $limit: 3
               },
               {
                   $sort: { total: -1}
               }
           ])
           return vendedores
        },
        buscarProducto:async(_,{texto})=>{
            const productos = await Producto.find({$text:{$search : texto}})

            return productos
        }
    },
    Mutation:{
        nuevoUsuario: async(_,{input})=> {

            const { email, password } = input
            // revisar si el usuario ya esta registrado
            const existeUsuario = await Usuario.findOne({email})
            if(existeUsuario){
                throw new Error('El usuario ya se encuentra registrado')
            }
            //hashear el pass
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password,salt)
            //guardar en la db
            try{
                const usuario = new Usuario(input)
                usuario.save()
                return usuario
            }
            catch{
                console.log(error)
            }
        },
        autenticarUsuario: async(_,{input})=>{
            // Si el usuario existe
            const { email, password } = input

            const existeUsuario = await Usuario.findOne({email})
            if(!existeUsuario){
                throw new Error('El usuario no existe')
            }

            //revisar el password correcto
            const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password)
            if(!passwordCorrecto){
                throw new Error('El password es incorrecto')
            }

            //crear el token
            return{
                token: crearToken(existeUsuario, process.env.SECRETA, '24h')
            }

        },
        nuevoProducto: async(_,{input})=>{
            try{
                const producto = new Producto(input)
                producto.save()
                return producto
            }catch{
                console.log(error)
            }
        },
        actualizarProducto:async(_, {id,input} )=>{
            let producto = await Producto.findById(id)
            if(!producto){
                throw new Error('Producto no encontrado')
            }

            //guardarlo en DB
            producto = await Producto.findOneAndUpdate({_id:id}, input, {new:true} );

            return producto
        },
        eliminarProducto:async(_,{id})=>{
           let producto = await Producto.findById(id)

           if(!producto){
               throw new Error('producto  no encontrado')
           }

           await Producto.findByIdAndDelete({_id:id});

           return "Producto Eliminado"
        },
        nuevoCliente:async(_,{input},ctx)=>{
            console.log(ctx)
            //verificar si el cliente ya esta registrado
            const {email} = input
            const cliente = await Cliente.findOne({email})
            if(cliente){
                throw new Error('El cliente ya se encuentra en la base de datos')
            }
            const nuevoCliente = new Cliente(input)
            nuevoCliente.vendedor = ctx.usuario.id

            try{
                
                nuevoCliente.save()
                return nuevoCliente
            }catch(error){
                console.log(error)
            }


            //asiganr el vendedor

            //guardarlo en la base de datos
        }, 
        actualizarCliente: async(_,{id,input},ctx)=>{
            let cliente = await Cliente.findById(id);
            if(!cliente){
                throw new Error('Cliente no encontrado')
            }

            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales para')
            }     
            
            cliente = await Cliente.findOneAndUpdate({_id:id}, input, {new:true} );

            return cliente
        },
        eliminarCliente:async(_,{id},ctx)=>{
            let cliente = await Cliente.findById(id)
            if(!cliente){
                throw new Error('el cliente no existe')
            }

            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales para')
            } 
            
            await Cliente.findOneAndDelete({_id:id})

            return "Cliente Eliminado"

        },
        nuevoPedido:async(_,{input},ctx)=>{
            const {cliente} = input
            //verificar existencia del cliente
            let clienteExiste = await Cliente.findById(cliente)
 
            if(!clienteExiste){
                throw new Error('el cliente no existe')
            }
             //verificar si el cliente es del vendedor
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tiene las credenciales')
            }

           //el stock este disponible

            for await (const articulo of input.pedido){
                const { id } = articulo

                const producto =  await Producto.findById(id)

                if(articulo.cantidad > producto.existencia){
                    throw new Error(` el articulo ${producto.nombre} excede la cantidad disponible`)
                }else{
                    producto.existencia = producto.existencia - articulo.cantidad

                    await producto.save()
                }
            } 
            

            //asiganrle un vendedor
            const nuevoPedido = new Pedido(input)
            nuevoPedido.vendedor = ctx.usuario.id


            //guardarlo
            const resultado = await nuevoPedido.save()
            return resultado 
        },
        actualizarPedido: async(_,{id, input}, ctx)=>{
            const {cliente} = input

            let pedidoExiste = await Pedido.findById(id)
            if(!pedidoExiste){
                throw new Error('No existe el pedido')
            } 

            const existeCliente = await Cliente.findById(cliente)
            if(!existeCliente){
                throw new Error('El client no existe')
            }

            if(existeCliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('no tiene las credenciales para actualizar el pedido')
            }

            if(input.pedido){
            for await ( const articulo of input.pedido){
                const {id} = articulo

                const producto = await Producto.findById(id)

                if(articulo.cantidad > producto.existencia){
                    throw new Error('el articulo excede la cantida del  inventgario')
                }else{
                    producto.existencia = producto.existencia - articulo.cantidad

                    await producto.save()
                }
            }
        }
            const resultado = await Pedido.findOneAndUpdate({_id:id}, input, {new:true})

            return resultado
        },
        eliminarPedido: async(_,{id},ctx)=>{
            let pedido = await Pedido.findById(id)

            if(!pedido){
                throw new Error('El pedido no existe')
            }

            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tiene las credenciales para eliminar el pedido')
            }

            await Pedido.findOneAndDelete({_id:id})

            return "Pedido Eliminado"
        }
    }
}

module.exports = resolvers