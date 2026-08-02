import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles, Scopes } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlJwtAuthGuard } from '../auth/guards/gql-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { AuthUser } from '../auth/types/auth-user';
import {
  OpenCorrectionSessionInput,
  SaveCorrectionSessionDraftInput,
} from '../graphql/generated/graphql.types';
import { CorrectionSessionsService } from './correction-sessions.service';

@Resolver()
@Roles('CORRECTOR')
@Scopes('corrections:write')
@UseGuards(GqlJwtAuthGuard, RolesGuard, ScopesGuard)
export class CorrectionSessionsResolver {
  constructor(private readonly correctionSessionsService: CorrectionSessionsService) {}

  @Query('correctionSession')
  correctionSession(@Args('sessionId') sessionId: string, @CurrentUser() authUser: AuthUser) {
    return this.correctionSessionsService.getSession(sessionId, authUser);
  }

  @Query('correctionSessions')
  correctionSessions(@CurrentUser() authUser: AuthUser) {
    return this.correctionSessionsService.listSessions(authUser);
  }

  @Mutation('openCorrectionSession')
  openCorrectionSession(
    @Args('input') input: OpenCorrectionSessionInput,
    @CurrentUser() authUser: AuthUser,
  ) {
    return this.correctionSessionsService.openSession(input, authUser);
  }

  @Mutation('saveCorrectionSessionDraft')
  saveCorrectionSessionDraft(
    @Args('input') input: SaveCorrectionSessionDraftInput,
    @CurrentUser() authUser: AuthUser,
  ) {
    return this.correctionSessionsService.saveDraft(input, authUser);
  }
}
