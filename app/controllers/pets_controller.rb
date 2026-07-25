class PetsController < ApplicationController
  before_action :require_current_team_member!
  before_action :set_owned_pet, only: [ :update, :destroy ]

  def create
    if current_team_member.pets.count >= 3
      redirect_to root_path, alert: "You already have the maximum of 3 pets."
      return
    end

    pet = current_team_member.pets.build(pet_params)

    if pet.save
      redirect_to root_path, notice: "Pet created."
    else
      redirect_to root_path, alert: pet.errors.full_messages.to_sentence
    end
  end

  def update
    if @pet.update(pet_params)
      redirect_to root_path, notice: "Pet updated."
    else
      redirect_to root_path, alert: @pet.errors.full_messages.to_sentence
    end
  end

  def destroy
    @pet.destroy
    redirect_to root_path, notice: "Pet deleted."
  end

  private

  def set_owned_pet
    @pet = current_team_member.pets.find_by(id: params[:id])
    return if @pet

    redirect_to root_path, alert: "You can only edit your own pets."
  end

  def pet_params
    params.expect(pet: [ :name, :mood, :description, :picture ])
  end
end
