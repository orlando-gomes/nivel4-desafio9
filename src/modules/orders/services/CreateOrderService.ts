import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('This customer does not exist.');
    }

    const storagedProducts = await this.productsRepository.findAllById(
      products,
    );

    if (storagedProducts.length < products.length) {
      throw new AppError('One of the provided products does not exist');
    }

    const productsToOrder = products.map(product => {
      const sameIdStoragedProduct = storagedProducts.find(
        storagedProduct => storagedProduct.id === product.id,
      );

      if (!sameIdStoragedProduct) {
        throw new AppError('Internal error');
      }

      if (sameIdStoragedProduct.quantity < product.quantity) {
        throw new AppError(
          `Quantity of product ${sameIdStoragedProduct.name} is not enought`,
        );
      }

      sameIdStoragedProduct.quantity -= product.quantity;

      return {
        product_id: sameIdStoragedProduct.id,
        price: sameIdStoragedProduct.price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsToOrder,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
