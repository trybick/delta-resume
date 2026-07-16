FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY DeltaResume.Api.fsproj .
RUN dotnet restore

COPY . .
RUN dotnet publish DeltaResume.Api.fsproj -c Release -o /app/out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-liberation \
        fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/out .

ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "DeltaResume.Api.dll"]
