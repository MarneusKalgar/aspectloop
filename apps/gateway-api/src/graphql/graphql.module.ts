import { YogaDriver, YogaDriverConfig } from '@graphql-yoga/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { getCorsOrigins } from '#app/core/setupCors';

import { maskGraphqlError } from './errors/mask-graphql-error';
import { createDisableIntrospectionPlugin } from './introspection/disable-introspection.plugin';
import { createGraphqlLoggingPlugin } from './logging/graphql-logging.plugin';
import { createGatewayRequestProtectionPlugin } from './request-protection/gateway-request-protection.plugin';
import { DateTimeScalar } from './scalars/datetime.scalar';
import { JsonScalar } from './scalars/json.scalar';

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
        const plugins = [
          createGatewayRequestProtectionPlugin(
            getCorsOrigins(configService.getOrThrow<string>('CORS_ALLOWED_ORIGINS')),
          ),
          createGraphqlLoggingPlugin(),
        ];

        if (disableIntrospectionPlugin) {
          plugins.push(disableIntrospectionPlugin);
        }

        return {
          batching: false,
          context: ({ req }: { req: unknown }) => ({ req }),
          cors: false,
          graphiql: !isRuntimeBuild,
          logging: false,
          maskedErrors: { maskError: maskGraphqlError },
          multipart: false,
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
