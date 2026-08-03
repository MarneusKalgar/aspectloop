import type { CorrectionSessionsQuery } from '@app/graphql/generated/graphql';
import type { GraphqlOperationState } from '@app/graphql/hooks/types';

import { useQuery } from '@apollo/client/react';
import { graphql } from '@app/graphql/generated';
import { getOperationErrorMessage } from '@app/graphql/utils/getOperationErrorMessage';

const correctionSessionsQueryDocument = graphql(`
  query CorrectionSessions {
    correctionSessions {
      id
      documentId
      documentType
      status
      version
      updatedAt
    }
  }
`);

/**
 * Loads correction sessions for the authenticated user's inbox.
 *
 * @returns The current correction-session data, error, and loading state.
 */
export function useCorrectionSessionsQuery(): GraphqlOperationState<
  CorrectionSessionsQuery['correctionSessions']
> {
  const { data, error, loading } = useQuery(correctionSessionsQueryDocument);

  return {
    data:
      data?.correctionSessions.map(
        /**
         * Maps generated GraphQL data into the inbox row shape.
         *
         * @param session One correction session returned by the query.
         * @returns The inbox row fields selected by the operation.
         */
        (session) => ({
          documentId: session.documentId,
          documentType: session.documentType,
          id: session.id,
          status: session.status,
          updatedAt: session.updatedAt,
          version: session.version,
        }),
      ) ?? null,
    error: getOperationErrorMessage(error),
    loading,
  };
}
