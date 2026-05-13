import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { DateTimeScalar } from './scalars/datetime.scalar';
import { JsonScalar } from './scalars/json.scalar';

@Module({
  imports: [
    ConfigModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV');
        const isRuntimeBuild = nodeEnv === 'production' || nodeEnv === 'stage';
        const schemaGlob = isRuntimeBuild
          ? 'dist/graphql/schema/**/*.graphql'
          : 'src/graphql/schema/**/*.graphql';

        return {
          context: ({ req }: { req: unknown }) => ({ req }),
          definitions: isRuntimeBuild
            ? undefined
            : {
                outputAs: 'class',
                path: join(process.cwd(), 'src/graphql/graphql.types.ts'),
              },
          driver: ApolloDriver,
          graphiql: !isRuntimeBuild,
          introspection: !isRuntimeBuild,
          path: '/graphql',
          sortSchema: true,
          stopOnTerminationSignals: false,
          typePaths: [join(process.cwd(), schemaGlob)],
        };
      },
    }),
  ],
  providers: [DateTimeScalar, JsonScalar],
})
export class GraphqlApiModule {}
