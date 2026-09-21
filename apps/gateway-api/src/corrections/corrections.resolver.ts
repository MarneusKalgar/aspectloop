import { PLATFORM_AUTH_ROLE, PLATFORM_AUTH_SCOPE } from '@aspectloop/contracts/platform';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { RequestId, Roles, Scopes } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlJwtAuthGuard } from '../auth/guards/gql-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { AuthUser } from '../auth/types/auth-user';
import { SubmitCorrectionsInput } from '../graphql/generated/graphql.types';
import { SubmitCorrectionsCommandInput } from './correction-flow.types';
import { CorrectionsService } from './corrections.service';

@Resolver()
@Roles(PLATFORM_AUTH_ROLE.CORRECTOR)
@Scopes(PLATFORM_AUTH_SCOPE.CORRECTIONS_WRITE)
@UseGuards(GqlJwtAuthGuard, RolesGuard, ScopesGuard)
export class CorrectionsResolver {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Query('correctionDocument')
  correctionDocument(
    @Args('sessionId') sessionId: string,
    @CurrentUser() authUser: AuthUser,
    @RequestId() requestId?: string,
  ) {
    return this.correctionsService.getCorrectionDocument(sessionId, authUser, { requestId });
  }

  @Mutation('submitCorrections')
  submitCorrections(
    @Args('input') input: SubmitCorrectionsInput,
    @CurrentUser() authUser: AuthUser,
    @RequestId() requestId?: string,
  ) {
    return this.correctionsService.submitCorrections(mapSubmitCorrectionsInput(input), authUser, {
      requestId,
    });
  }
}

function mapSubmitCorrectionsInput(input: SubmitCorrectionsInput): SubmitCorrectionsCommandInput {
  return {
    edits: input.edits.map((edit) => {
      const value: unknown = edit.value ?? null;

      return {
        fieldId: edit.fieldId,
        path: edit.path,
        value,
      };
    }),
    expectedVersion: input.expectedVersion,
    sessionId: input.sessionId,
  };
}
