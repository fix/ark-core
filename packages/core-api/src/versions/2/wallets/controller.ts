import { app } from "@arkecosystem/core-container";
import Boom from "boom";
import Hapi from "hapi";
import { blocksRepository, transactionsRepository } from "../../../repositories";
import Controller from "../shared/controller";

export default class WalletsController extends Controller {
  protected database: any;

  public constructor() {
    super();

    this.database = app.resolvePlugin("database");
  }

  public async index(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.index(request);

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }

  public async top(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.top(request);

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }

  public async show(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.show(request);

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }

  public async transactions(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.transactions(request);

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }

  public async transactionsSent(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.transactionsSent(
        request,
      );

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }

  public async transactionsReceived(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.transactionsReceived(
        request,
      );

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }

  public async votes(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.votes(request);

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }

  public async search(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    try {
      const data = await request.server.methods.v2.wallets.search(request);

      return super.respondWithCache(data, h);
    } catch (error) {
      return Boom.badImplementation(error);
    }
  }
}
