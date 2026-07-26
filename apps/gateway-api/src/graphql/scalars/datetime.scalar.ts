import { BadRequestException } from '@nestjs/common';
import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = 'ISO-8601 date-time scalar';

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind !== Kind.STRING) {
      throw new BadRequestException('DateTime value must be a string literal');
    }

    return parseDateTimeString(ast.value);
  }

  parseValue(value: unknown): Date | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('DateTime value must be a string');
    }

    return parseDateTimeString(value);
  }

  serialize(value: unknown): null | string | undefined {
    if (value === null || value === undefined) {
      return value;
    }

    if (!(value instanceof Date) && typeof value !== 'string') {
      throw new BadRequestException('DateTime value must be a Date or ISO string');
    }

    const date = value instanceof Date ? value : parseDateTimeString(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid DateTime value');
    }

    return date.toISOString();
  }
}

function parseDateTimeString(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid DateTime value');
  }

  return date;
}
