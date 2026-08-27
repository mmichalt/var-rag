export class AcquisitionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AcquisitionError';
  }
}

export function assertFamilyApproved(family: {
  name: string;
  rightsStatus: string;
}): void {
  if (family.rightsStatus !== 'APPROVED') {
    throw new AcquisitionError(
      'RIGHTS_NOT_APPROVED',
      `Acquisition refused for family '${family.name}': rightsStatus is ${family.rightsStatus}, not APPROVED`,
    );
  }
}
