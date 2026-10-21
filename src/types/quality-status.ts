/** Only a successful review of the current complete text may produce "passed". */
export type QualityStatus = "passed" | "rejected" | "failed" | "disabled";

export function qualityStatusMessage(status: QualityStatus): string {
  switch (status) {
    case "passed": return "Texten har godkänts i kvalitetsgranskningen.";
    case "rejected": return "Texten är inte godkänd i kvalitetsgranskningen. Kontrollera innehållet innan du använder den.";
    case "disabled": return "Kvalitetsgranskningen är avstängd. Texten är inte kvalitetsgranskad.";
    case "failed": return "Kvalitetsgranskningen kunde inte slutföras. Texten är inte färdiggranskad.";
  }
}
