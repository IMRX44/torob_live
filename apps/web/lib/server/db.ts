import "server-only";
import { getSql } from "@torob/db";

export const sql = () => getSql();
