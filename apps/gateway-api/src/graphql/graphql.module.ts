import { YogaDriver, YogaDriverConfig } from '@graphql-yoga/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { DateTimeScalar } from './scalars/datetime.scalar';
import { JsonScalar } from './scalars/json.scalar';
import { createDisableIntrospectionPlugin } from './utils/createDisableIntrospectionPlugin';
import { createGraphqlLoggingPlugin } from './utils/createGraphqlLoggingPlugin';
import { maskGraphqlError } from './utils/maskGraphqlError';

@Module({
  imports: [
    ConfigModule,
    GraphQLModule.forRootAsync<YogaDriverConfig>({
      driver: YogaDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV');
        const isRuntimeBuild = nodeEnv === 'production' || nodeEnv === 'stage';
        const schemaGlob = isRuntimeBuild
          ? 'dist/graphql/schema/**/*.graphql'
          : 'src/graphql/schema/**/*.graphql';
        const disableIntrospectionPlugin = createDisableIntrospectionPlugin(isRuntimeBuild);
        const plugins = [createGraphqlLoggingPlugin()];

        if (disableIntrospectionPlugin) {
          plugins.push(disableIntrospectionPlugin);
        }

        return {
          context: ({ req }: { req: unknown }) => ({ req }),
          cors: false,
          graphiql: !isRuntimeBuild,
          logging: false,
          maskedErrors: { maskError: maskGraphqlError },
          path: '/graphql',
          plugins,
          sortSchema: true,
          stopOnApplicationShutdown: false,
          typePaths: [join(process.cwd(), schemaGlob)],
        };
      },
    }),
  ],
  providers: [DateTimeScalar, JsonScalar],
})
export class GraphqlApiModule {}
