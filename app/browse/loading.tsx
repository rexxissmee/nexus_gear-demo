import { Skeleton } from "@/components/ui/skeleton"

export default function BrowseLoading() {
  return (
    <div className="container px-4 py-8 mx-auto">
      {/* Header Skeleton */}
      <div className="mb-8">
        <Skeleton className="h-8 w-48 mb-4" />

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <Skeleton className="h-10 w-full md:w-96" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-24 md:hidden" />
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar Skeleton */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-white dark:bg-gray-900 p-6 rounded-lg border">
            <Skeleton className="h-6 w-16 mb-4" />
            <div className="space-y-6">
              <div>
                <Skeleton className="h-5 w-20 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-5 w-16 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid Skeleton */}
        <div className="flex-1">
          <Skeleton className="h-4 w-48 mb-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
