"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"

interface WizardStep {
  id: string
  title: string
  required: boolean
  conditional?: boolean
}

interface ProposalFormWizardProps {
  children: React.ReactNode
  steps: WizardStep[]
  currentStep: number
  onStepChange: (step: number) => void
  onNext: () => boolean // Returns true if validation passed
  onBack: () => void
  canGoNext: boolean
  onComplete?: () => void
  isEditing?: boolean
}

export function ProposalFormWizard({
  children,
  steps,
  currentStep,
  onStepChange,
  onNext,
  onBack,
  canGoNext,
  onComplete,
  isEditing = false,
}: ProposalFormWizardProps) {
  // Steps are already filtered by the parent component
  const visibleSteps = steps
  const totalSteps = visibleSteps.length

  const handleNext = () => {
    if (canGoNext && onNext()) {
      if (currentStep < totalSteps - 1) {
        onStepChange(currentStep + 1)
      } else if (onComplete) {
        onComplete()
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      onBack()
      onStepChange(currentStep - 1)
    }
  }


  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {visibleSteps.map((step, index) => {
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              const isUpcoming = index > currentStep

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        // Allow going back to previous steps
                        if (index <= currentStep || isEditing) {
                          onStepChange(index)
                        }
                      }}
                      disabled={!isEditing && index > currentStep}
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : isCompleted
                          ? "border-green-600 bg-green-600 text-white cursor-pointer hover:bg-green-700"
                          : "border-gray-300 bg-white text-gray-400 cursor-not-allowed"
                      } ${isCompleted && isEditing ? "cursor-pointer" : ""}`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </button>
                    <div className={`mt-2 text-xs text-center max-w-[100px] ${
                      isActive ? "font-semibold text-blue-600" : "text-gray-500"
                    }`}>
                      {step.title}
                    </div>
                  </div>
                  {index < visibleSteps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      isCompleted ? "bg-green-600" : "bg-gray-300"
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Step {currentStep + 1} of {totalSteps}: {visibleSteps[currentStep]?.title}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {children}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex gap-2">
          {currentStep < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Complete Step
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
