import { INTERNAL_SERVER_ERROR } from "http-status";
import { Request, Response, NextFunction } from "express";
import axios from "axios";

import { CustomError } from "../errors/custom-error";
import { isCelebrateError } from "celebrate";
import { H } from '@highlight-run/node'
import { highlightConfig } from "../highlight";
import pinoLogger from "./logger";

H.init(highlightConfig);

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (axios.isAxiosError(err)) {
    // log.error(
    //   "Axios Error. Status: %o, Error: %o",
    //   err.code,
    //   err.response?.data
    // );
    return res.status(err.response!.status! || 500).send({
      status: false,
      message: err.response?.data.message || "Something went wrong",
      code: err.response?.status,
    });
  }

  if (err instanceof CustomError) {
    // log.error(
    //   "User Error. Status: %o, Error: %o",
    //   err.statusCode,
    //   err.serializeErrors()
    // );
    return res.status(err.statusCode).send(err.serializeErrors());
  }

  // log.error(
  //   "Application Error. Message: %o, Stack: %o, Error: %o",
  //   err.message,
  //   err.stack,
  //   err
  // );

  if(isCelebrateError(err)){
    const errors = {}
     Array.from(err.details.keys()).forEach(key => {
      errors[key] = err.details.get(key).details.map(err => ({ [err.path[0]]: err.message }))
     })
    return res.status(400).json({ errors, code: 400, message: err.message }).end()
  }

  const { secureSessionId, requestId } = H.parseHeaders(req.headers);
  H.consumeError(
    err as Error,
    secureSessionId,
    requestId
  );

  pinoLogger.error({ err, req, res });
  console.trace(err);
  
  return res.status(INTERNAL_SERVER_ERROR).send({
    status: false,
    message: process.env.NODE_ENV !== "production" ? err.message || "Something went wrong" : 
    "Something went wrong, please try again later.",
    code: 500,
  });
};
