import { NextResponse } from "next/server";

export function apiSuccess<T extends object>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

export function apiError(error: string, status = 500) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}
