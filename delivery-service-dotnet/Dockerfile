# ==============================
# BUILD STAGE
# ==============================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

COPY delivery-service-dotnet.csproj ./

RUN dotnet restore ./delivery-service-dotnet.csproj

COPY . .

RUN dotnet publish ./delivery-service-dotnet.csproj -c Release -o /app/publish


# ==============================
# RUNTIME STAGE
# ==============================
FROM mcr.microsoft.com/dotnet/aspnet:10.0

WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 5007

ENTRYPOINT ["dotnet", "delivery-service-dotnet.dll"]